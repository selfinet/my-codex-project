import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'todo_jwt';
const LANGUAGE_KEY = 'todo_language';

const TRANSLATIONS = {
  ko: {
    languageLabel: '언어',
    loginRequired: '로그인이 필요합니다.',
    sessionExpired: '세션이 만료되었습니다. 다시 로그인해주세요.',
    loadFailed: '할 일을 불러오지 못했습니다.',
    unknownError: '알 수 없는 오류가 발생했습니다.',
    addFailed: '할 일을 추가하지 못했습니다.',
    statusUpdateFailed: '상태를 변경하지 못했습니다.',
    deleteFailed: '할 일을 삭제하지 못했습니다.',
    registerFailed: '회원가입에 실패했습니다.',
    registerSuccess: '회원가입이 완료되었습니다. 로그인해주세요.',
    loginFailed: '로그인하지 못했습니다.',
    appTitle: 'TODO 리스트',
    tagline: 'FastAPI + React',
    usernamePlaceholder: '아이디',
    passwordPlaceholder: '비밀번호',
    processing: '처리 중...',
    login: '로그인',
    register: '회원가입',
    promptSignUp: '계정이 없다면 회원가입하기',
    promptLogin: '이미 계정이 있다면 로그인하기',
    todoHeader: '할 일 목록',
    pending: (count) => `남은 할 일 ${count}개`,
    allDone: '모든 할 일을 완료했습니다!',
    logout: '로그아웃',
    todoPlaceholder: '해야 할 일을 입력하세요',
    adding: '추가 중...',
    add: '추가',
    loading: '불러오는 중...',
    empty: '아직 등록된 할 일이 없습니다.',
    deleteLabel: '삭제',
  },
  en: {
    languageLabel: 'Language',
    loginRequired: 'Please sign in first.',
    sessionExpired: 'Session expired. Please sign in again.',
    loadFailed: 'Failed to load todos.',
    unknownError: 'Something went wrong.',
    addFailed: 'Failed to add the todo.',
    statusUpdateFailed: 'Failed to update the status.',
    deleteFailed: 'Failed to delete the todo.',
    registerFailed: 'Could not sign up.',
    registerSuccess: 'Sign-up complete. Please log in.',
    loginFailed: 'Could not log in.',
    appTitle: 'TODO List',
    tagline: 'FastAPI + React',
    usernamePlaceholder: 'Username',
    passwordPlaceholder: 'Password',
    processing: 'Working...',
    login: 'Log in',
    register: 'Sign up',
    promptSignUp: 'Need an account? Sign up',
    promptLogin: 'Already have an account? Log in',
    todoHeader: 'Todo List',
    pending: (count) => `${count} tasks remaining`,
    allDone: 'All tasks completed!',
    logout: 'Log out',
    todoPlaceholder: 'Enter a task',
    adding: 'Adding...',
    add: 'Add',
    loading: 'Loading...',
    empty: 'No todos yet.',
    deleteLabel: 'Delete',
  },
};

const LANGUAGE_OPTIONS = [
  { code: 'ko', label: '한글' },
  { code: 'en', label: '영문' },
];

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
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'ko';
    return localStorage.getItem(LANGUAGE_KEY) ?? 'ko';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  const t = TRANSLATIONS[language] ?? TRANSLATIONS.ko;

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
      if (!token) throw new Error(t.loginRequired);
      const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      };
      const response = await fetch(`${API_URL}${path}`, { ...options, headers });
      if (response.status === 401) {
        saveToken('');
        setTodos([]);
        throw new Error(t.sessionExpired);
      }
      return response;
    },
    [token, saveToken, t, language],
  );

  const fetchTodos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/todos');
      if (!response.ok) throw new Error(t.loadFailed);
      const data = await response.json();
      setTodos(data);
    } catch (err) {
      setError(err.message ?? t.unknownError);
    } finally {
      setLoading(false);
    }
  }, [token, fetchWithAuth, t]);

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
      if (!response.ok) throw new Error(t.addFailed);
      const data = await response.json();
      setTodos((current) => [data, ...current]);
      setText('');
    } catch (err) {
      setError(err.message ?? t.unknownError);
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
      if (!response.ok) throw new Error(t.statusUpdateFailed);
      const data = await response.json();
      setTodos((current) => current.map((todo) => (todo.id === id ? data : todo)));
    } catch (err) {
      setError(err.message ?? t.unknownError);
    }
  }

  async function deleteTodo(id) {
    setError('');
    try {
      const response = await fetchWithAuth(`/todos/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(t.deleteFailed);
      setTodos((current) => current.filter((todo) => todo.id !== id));
    } catch (err) {
      setError(err.message ?? t.unknownError);
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
        if (!response.ok) throw new Error(t.registerFailed);
        setAuthMessage(t.registerSuccess);
        setAuthMode('login');
        setPassword('');
      } else {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        if (!response.ok) throw new Error(t.loginFailed);
        const data = await response.json();
        saveToken(data.access_token);
        setUsername('');
        setPassword('');
        setAuthMessage('');
      }
    } catch (err) {
      setError(err.message ?? t.unknownError);
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

  const languageSwitcher = (
    <div className="language-switch">
      <span>{t.languageLabel}</span>
      {LANGUAGE_OPTIONS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={code === language ? 'active' : ''}
          onClick={() => setLanguage(code)}
          disabled={code === language}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (!token) {
    const isLogin = authMode === 'login';
    return (
      <main className="app auth">
        {languageSwitcher}
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t.usernamePlaceholder}
            autoComplete="username"
            disabled={authLoading}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t.passwordPlaceholder}
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            disabled={authLoading}
          />
          <button type="submit" disabled={authLoading}>
            {authLoading ? t.processing : isLogin ? t.login : t.register}
          </button>
        </form>
        {authMessage && <p className="status success">{authMessage}</p>}
        {error && <p className="status">{error}</p>}
        <button className="auth-toggle" type="button" onClick={toggleAuthMode}>
          {isLogin ? t.promptSignUp : t.promptLogin}
        </button>
      </main>
    );
  }

  return (
    <main className="app">
      {languageSwitcher}
      <header>
        <div className="header-row">
          <div>
            <h1>{t.todoHeader}</h1>
            <p>
              {pendingCount > 0 ? t.pending(pendingCount) : t.allDone}
            </p>
          </div>
          <button className="logout-btn" type="button" onClick={logout}>
            {t.logout}
          </button>
        </div>
        <form className="todo-form" onSubmit={handleSubmit}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t.todoPlaceholder}
            disabled={saving}
          />
          <button type="submit" disabled={saving}>
            {saving ? t.adding : t.add}
          </button>
        </form>
      </header>

      {loading ? (
        <p className="empty-state">{t.loading}</p>
      ) : todos.length === 0 ? (
        <p className="empty-state">{t.empty}</p>
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
              <button type="button" onClick={() => deleteTodo(todo.id)} aria-label={t.deleteLabel}>
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
