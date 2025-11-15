import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'todo_jwt';

export default function App() {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(TOKEN_KEY) ?? '';
  });
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const pendingCount = useMemo(
    () => todos.filter((todo) => !todo.done).length,
    [todos],
  );

  const saveToken = useCallback((value) => {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setToken(value);
  }, []);

  const fetchWithAuth = useCallback(
    async (path, options = {}) => {
      if (!token) throw new Error('로그인이 필요합니다.');
      const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      };
      const response = await fetch(`${API_URL}${path}`, { ...options, headers });
      if (response.status === 401) {
        saveToken('');
        setTodos([]);
        throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
      }
      return response;
    },
    [token, saveToken],
  );

  const fetchTodos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/todos');
      if (!response.ok) throw new Error('할 일을 불러오지 못했습니다.');
      const data = await response.json();
      setTodos(data);
    } catch (err) {
      setError(err.message ?? '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, fetchWithAuth]);

  useEffect(() => {
    if (!token) {
      setTodos([]);
      setLoading(false);
      return;
    }
    fetchTodos();
  }, [token, fetchTodos]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!text.trim() || !token) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetchWithAuth('/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!response.ok) throw new Error('할 일을 추가하지 못했습니다.');
      const data = await response.json();
      setTodos((current) => [data, ...current]);
      setText('');
    } catch (err) {
      setError(err.message ?? '알 수 없는 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTodo(id, done) {
    setError('');
    try {
      const response = await fetchWithAuth(`/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });
      if (!response.ok) throw new Error('상태를 변경하지 못했습니다.');
      const data = await response.json();
      setTodos((current) => current.map((todo) => (todo.id === id ? data : todo)));
    } catch (err) {
      setError(err.message ?? '알 수 없는 오류가 발생했습니다.');
    }
  }

  async function deleteTodo(id) {
    setError('');
    try {
      const response = await fetchWithAuth(`/todos/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('할 일을 삭제하지 못했습니다.');
      setTodos((current) => current.filter((todo) => todo.id !== id));
    } catch (err) {
      setError(err.message ?? '알 수 없는 오류가 발생했습니다.');
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setAuthLoading(true);
    setAuthMessage('');
    setError('');
    try {
      if (authMode === 'register') {
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        if (!response.ok) throw new Error('회원가입에 실패했습니다.');
        setAuthMessage('회원가입이 완료되었습니다. 로그인해주세요.');
        setAuthMode('login');
        setPassword('');
      } else {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        if (!response.ok) throw new Error('로그인하지 못했습니다.');
        const data = await response.json();
        saveToken(data.access_token);
        setUsername('');
        setPassword('');
        setAuthMessage('');
      }
    } catch (err) {
      setError(err.message ?? '알 수 없는 오류가 발생했습니다.');
    } finally {
      setAuthLoading(false);
    }
  }

  function toggleAuthMode() {
    setAuthMode((mode) => (mode === 'login' ? 'register' : 'login'));
    setError('');
    setAuthMessage('');
    setPassword('');
  }

  function logout() {
    saveToken('');
    setTodos([]);
    setError('');
    setText('');
  }

  if (!token) {
    const isLogin = authMode === 'login';
    return (
      <main className="app auth">
        <h1>TODO 리스트</h1>
        <p>FastAPI + React</p>
        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="아이디"
            autoComplete="username"
            disabled={authLoading}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            disabled={authLoading}
          />
          <button type="submit" disabled={authLoading}>
            {authLoading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>
        {authMessage && <p className="status success">{authMessage}</p>}
        {error && <p className="status">{error}</p>}
        <button className="auth-toggle" type="button" onClick={toggleAuthMode}>
          {isLogin ? '계정이 없다면 회원가입하기' : '이미 계정이 있다면 로그인하기'}
        </button>
      </main>
    );
  }

  return (
    <main className="app">
      <header>
        <div className="header-row">
          <div>
            <h1>할 일 목록</h1>
            <p>
              {pendingCount > 0
                ? `남은 할 일 ${pendingCount}개`
                : '모든 할 일을 완료했습니다!'}
            </p>
          </div>
          <button className="logout-btn" type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
        <form className="todo-form" onSubmit={handleSubmit}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="해야 할 일을 입력하세요"
            disabled={saving}
          />
          <button type="submit" disabled={saving}>
            {saving ? '추가 중...' : '추가'}
          </button>
        </form>
      </header>

      {loading ? (
        <p className="empty-state">불러오는 중...</p>
      ) : todos.length === 0 ? (
        <p className="empty-state">아직 등록된 할 일이 없습니다.</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => (
            <li className={`todo-item ${todo.done ? 'done' : ''}`} key={todo.id}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={(event) => toggleTodo(todo.id, event.target.checked)}
                />
                <span>{todo.text}</span>
              </label>
              <button type="button" onClick={() => deleteTodo(todo.id)} aria-label="삭제">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="status">{error}</p>}
      <p className="footer-hint">FastAPI + React (Vite)</p>
    </main>
  );
}
