# Repository Guidelines

## Project Structure & Module Organization
The monorepo is split into `backend/` (FastAPI app at `app/main.py`) and `frontend/` (React + Vite entrypoints `src/main.jsx` and `src/App.jsx`). State is currently in-memory: `_users` and `_todos_by_user` live inside `main.py`, so expect resets on server restart. Frontend assets (global styles in `src/App.css` and `src/index.css`) power the bilingual UI; keep new components under `src/components/` and export them through `App.jsx`.

## Build, Test, and Development Commands
Backend: `python -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt`, then `uvicorn app.main:app --reload --port 8000` from `backend/`. Frontend: `npm install` inside `frontend/`, `npm run dev -- --host` for live reloading, `npm run build` for the production bundle, `npm run preview` to verify it, and `npm run lint` for ESLint with the React, hooks, and refresh plugins.

## Coding Style & Naming Conventions
Python follows 4-space indentation, type-hinted FastAPI endpoints, and CamelCase Pydantic models (`TodoCreate`). Helper names stay snake_case (`_normalize_todo_text`). Backend errors already surface localized Korean strings; keep any new messages consistent. React files stay as ES modules with PascalCase components, hooks for state (`useState`, `useCallback`), and CSS class names defined in `App.css`. Persist client settings (language, token) through `localStorage` keys similar to `TOKEN_KEY`/`LANGUAGE_KEY`.

## Testing Guidelines
Introduce `pytest` suites under `backend/tests/test_*.py` using `fastapi.testclient.TestClient` to cover auth, todo CRUD, and validation helpers. For the frontend, add Vitest + React Testing Library specs under `frontend/src/__tests__/ComponentName.test.jsx` to exercise translation toggles, login/logout, and todo mutations (mock `fetch`). Gate PRs on `pytest` and `npm run lint`; document any intentionally skipped cases.

## Commit & Pull Request Guidelines
Commits in this repo are short, imperative statements (e.g., `Add FastAPI backend and React frontend with auth`). Follow that tense, scope each commit logically, and mention issue IDs when relevant. PRs should describe motivation, list backend/frontend commands you ran (`pytest`, `npm run lint`, `npm run build`), explain API or schema changes, and include screenshots or curl outputs for UI/API updates.

## Security & Configuration Tips
Configure `TODO_SECRET_KEY` (backend) and `VITE_API_URL` (frontend) via environment files that stay outside version control. Never log passwords; rely on `OAuth2PasswordBearer` and hashed secrets already provided. Tighten CORS and switch storage from in-memory to a database before production deployment.
