import { BaseApiClient } from './base';
import { LoginRequest, RegisterRequest, AuthResponse, User } from '../types/auth';
import { refreshAccessToken } from './tokenRefresh';

export class AuthApiService extends BaseApiClient {
  private readonly USER_KEY = 'current_user';

  constructor() {
    super();
  }

  // Токены не трогаем — бэкенд сам ставит httpOnly cookie
  private processAuthData(authData: AuthResponse) {
    this.setUser(authData.user);
  }

  async linkLogin(token: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseURL}/auth/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ссылка устарела' }));
      throw new Error(errorData.detail || 'Ссылка устарела');
    }

    const authData = await response.json();
    this.processAuthData(authData);
    return authData;
  }

  async telegram_login(initData: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseURL}/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка входа' }));
      throw new Error(errorData.detail || 'Неверные учетные данные');
    }

    const authData = await response.json();
    this.processAuthData(authData);
    return authData;
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      body: formData,
      credentials: 'include', // бэкенд поставит httpOnly cookie сам
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка входа' }));
      throw new Error(errorData.detail || 'Неверные учетные данные');
    }

    const authData = await response.json();
    this.processAuthData(authData);
    return authData;
  }

  async register(userData: RegisterRequest): Promise<User> {
    const response = await this.post<{ data: User }>('/auth/register', userData);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    // credentials: 'include' должен быть в BaseApiClient по умолчанию
    return this.get<User>('/auth/me');
  }

  async refreshToken(): Promise<void> {
    await refreshAccessToken(this.baseURL);
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseURL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      this.clearUser(); // только данные пользователя
    }
  }

  // Проверка: жив ли пользователь в памяти (не токен!)
  // Реальную валидность проверяем запросом к /auth/me
  isAuthenticated(): boolean {
    return !!this.getCurrentUserFromStorage();
  }

  hasRefreshToken(): boolean {
    // Мы не можем читать httpOnly cookie из JS — это намеренно
    // Просто пробуем refresh и смотрим на результат
    return true; // всегда пробуем, бэк вернёт 401 если нет
  }

  getCurrentUserFromStorage(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  private setUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  private clearUser(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.USER_KEY);
    }
  }

  // getToken больше не нужен для localStorage —
  // но если BaseApiClient требует его для Authorization header,
  // возвращаем null и полагаемся на cookie
  getToken(): string | null {
    return null;
  }

  // auth.ts
  public saveUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }
}

export const authApiService = new AuthApiService();