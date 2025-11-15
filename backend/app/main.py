from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field


class Todo(BaseModel):
    id: str
    text: str = Field(..., min_length=1)
    done: bool = False


class TodoCreate(BaseModel):
    text: str = Field(..., min_length=1)


class TodoUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1)
    done: Optional[bool] = None


class User(BaseModel):
    username: str


class UserInDB(User):
    hashed_password: str


class AuthPayload(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=128)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


SECRET_KEY = os.getenv("TODO_SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

app = FastAPI(title="Todo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# simple in-memory storage for demo purposes
_users: Dict[str, UserInDB] = {}
_todos_by_user: Dict[str, List[Todo]] = {}


# --- Auth helpers ------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt_b64, digest_b64 = hashed_password.split(":", 1)
    except ValueError:
        return False
    salt = base64.b64decode(salt_b64)
    digest = base64.b64decode(digest_b64)
    new_digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
    return hmac.compare_digest(new_digest, digest)


def get_password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{base64.b64encode(salt).decode()}:{base64.b64encode(digest).decode()}"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    user = _users.get(username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = _users.get(username)
    if user is None:
        raise credentials_exception
    return user


# --- Auth endpoints ----------------------------------------------------------


@app.post("/auth/register", response_model=User, status_code=201)
def register(payload: AuthPayload) -> User:
    username = payload.username.strip()
    if username in _users:
        raise HTTPException(status_code=400, detail="이미 존재하는 사용자입니다.")
    hashed_password = get_password_hash(payload.password)
    user = UserInDB(username=username, hashed_password=hashed_password)
    _users[username] = user
    _todos_by_user.setdefault(username, [])
    return User(username=username)


@app.post("/auth/login", response_model=Token)
def login(payload: AuthPayload) -> Token:
    user = authenticate_user(payload.username.strip(), payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    access_token = create_access_token({"sub": user.username})
    return Token(access_token=access_token)


# --- Todo helpers ------------------------------------------------------------


def _get_user_todos(username: str) -> List[Todo]:
    return _todos_by_user.setdefault(username, [])


def get_todo(todo_id: str, username: str) -> Todo:
    for todo in _get_user_todos(username):
        if todo.id == todo_id:
            return todo
    raise HTTPException(status_code=404, detail="Todo not found")


# --- Todo endpoints ----------------------------------------------------------


@app.get("/todos", response_model=List[Todo])
def list_todos(current_user: UserInDB = Depends(get_current_user)) -> List[Todo]:
    return _get_user_todos(current_user.username)


@app.post("/todos", response_model=Todo, status_code=201)
def create_todo(payload: TodoCreate, current_user: UserInDB = Depends(get_current_user)) -> Todo:
    todo = Todo(id=str(uuid4()), text=payload.text.strip(), done=False)
    todos = _get_user_todos(current_user.username)
    todos.insert(0, todo)
    return todo


@app.patch("/todos/{todo_id}", response_model=Todo)
def update_todo(
    todo_id: str,
    payload: TodoUpdate,
    current_user: UserInDB = Depends(get_current_user),
) -> Todo:
    todo = get_todo(todo_id, current_user.username)
    if payload.text is not None:
        todo.text = payload.text.strip()
    if payload.done is not None:
        todo.done = payload.done
    return todo


@app.delete("/todos/{todo_id}", status_code=204, response_model=None)
def delete_todo(todo_id: str, current_user: UserInDB = Depends(get_current_user)) -> Response:
    todos = _get_user_todos(current_user.username)
    remaining = [todo for todo in todos if todo.id != todo_id]
    if len(remaining) == len(todos):
        raise HTTPException(status_code=404, detail="Todo not found")
    _todos_by_user[current_user.username] = remaining
    return Response(status_code=204)
