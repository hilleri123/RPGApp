import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { authApiService } from '../api/auth';
import { ApiError } from '../api/base';
import { User, LoginRequest, RegisterRequest, AuthState } from '../types/auth';

async function fetchTelegramInitData(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const WebApp = (await import('@twa-dev/sdk')).default;
    WebApp.ready();
    return WebApp.initData || null;
  } catch (e) {
    console.warn('Telegram WebApp unavailable:', e);
    return null;
  }
}

// Контекст аутентификации
const AuthContext = createContext<{
  state: AuthState;
  login: (credentials: LoginRequest) => Promise<User>;
  telegram_login: () => Promise<User | undefined>;
  register: (userData: RegisterRequest) => Promise<User>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
} | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  });

  const telegram_login = useCallback(async (): Promise<User | undefined> => {
    const initData = await fetchTelegramInitData();
    if (!initData) return undefined;

    try {
      const response = await authApiService.telegram_login(initData);
      setState({
        user: response.user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return response.user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка входа через telegram';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      const storedUser = authApiService.getCurrentUserFromStorage();

      if (storedUser && !cancelled) {
        setState({ user: storedUser, isAuthenticated: false, loading: true, error: null });
      }

      const setGuest = () => {
        if (cancelled) return;
        authApiService.logout();
        setState({ user: null, isAuthenticated: false, loading: false, error: null });
      };

      const setAuthed = (user: User) => {
        if (cancelled) return;
        authApiService.saveUser(user);
        setState({ user, isAuthenticated: true, loading: false, error: null });
      };

      try {
        const user = await authApiService.getCurrentUser();
        setAuthed(user);
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          if (cancelled) return;
          setState({
            user: storedUser ?? null,
            isAuthenticated: false,
            loading: false,
            error: null,
          });
          return;
        }
      }

      try {
        await authApiService.refreshToken();
        const user = await authApiService.getCurrentUser();
        setAuthed(user);
        return;
      } catch {
        // пробуем Telegram или гость
      }

      const initData = await fetchTelegramInitData();
      if (initData) {
        try {
          const response = await authApiService.telegram_login(initData);
          setAuthed(response.user);
          return;
        } catch (e) {
          console.warn('Telegram bootstrap login failed:', e);
        }
      }

      setGuest();
    };

    void bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginRequest): Promise<User> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await authApiService.login(credentials);
      setState({
        user: response.user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return response.user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка входа';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const register = useCallback(async (userData: RegisterRequest): Promise<User> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      await authApiService.register(userData);
      const loginResponse = await authApiService.login({
        username: userData.full_name,
        password: userData.password,
      });

      setState({
        user: loginResponse.user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return loginResponse.user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка регистрации';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    authApiService.logout();
    setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      await authApiService.refreshToken();
      const user = await authApiService.getCurrentUser();
      authApiService.saveUser(user);
      setState((prev) => ({
        ...prev,
        user,
        isAuthenticated: true,
        loading: false,
      }));
    } catch (error) {
      logout();
      throw error;
    }
  }, [logout]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    login,
    telegram_login,
    register,
    logout,
    refreshAuth,
    clearError,
  };
}

export { AuthContext };
