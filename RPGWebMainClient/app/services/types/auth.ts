
// Базовый пользователь от API
export interface User {
  id: string;
  full_name: string;
  telegram_id?: string;
  email: string;
  is_active: boolean;
  created_at: string;
  can_be_master: boolean;
  is_admin: boolean;

  icon_url?: string;
  img_url?: string;
}

export interface UserUpdate extends User {
  old_password?: string;
  new_password?: string;
}

/** Что администратор меняет у другого пользователя. Роли только здесь:
 *  в правке своего профиля их нет намеренно. */
export type UserAdminPatch = Partial<
  Pick<User, 'full_name' | 'email' | 'is_active' | 'can_be_master' | 'is_admin'>
> & { new_password?: string };


export const getStatusColor = (user: User) => {
  if (user.is_active) return 'bg-green-500';
  // if (status === 'away') return 'bg-yellow-500';
  return 'bg-gray-400';
}


// Запрос на вход
export interface LoginRequest {
  username: string;
  password: string;
}

// Запрос на регистрацию
export interface RegisterRequest {
  // username: string;
  full_name: string;
  email: string;
  password: string;
}

// Ответ аутентификации
export interface AuthResponse {
  access_token: string;
  token_type: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  user: User;
}

// Расширенный пользователь для UI
export interface ExtendedUser extends User {
  level?: number;
  sessionsPlayed?: number;
  favoriteGenre?: string;
  avatar?: string;
}

// Форма входа
export interface LoginFormData {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// Форма регистрации
export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

// Токен данные
export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

// Состояние аутентификации
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Контекст аутентификации
export interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<User>;
  register: (userData: RegisterRequest) => Promise<User>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
}

// Ошибки аутентификации
export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

// Запрос смены пароля
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Запрос сброса пароля
export interface ResetPasswordRequest {
  email: string;
}

// Подтверждение сброса пароля
export interface ConfirmResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Настройки профиля
export interface ProfileUpdateRequest {
  username?: string;
  email?: string;
  avatar?: string;
}

// Роли пользователей
export type UserRole = 'player' | 'gamemaster' | 'admin';

// Расширенный пользователь с ролями
export interface UserWithRoles extends User {
  roles: UserRole[];
  permissions: string[];
}

// JWT Payload
export interface JWTPayload {
  sub: string; // user id
  username: string;
  email: string;
  roles: UserRole[];
  exp: number;
  iat: number;
}

// Типы для OAuth провайдеров
export interface OAuthProvider {
  id: string;
  name: string;
  enabled: boolean;
  clientId?: string;
}

// Социальный вход
export interface SocialAuthRequest {
  provider: string;
  code: string;
  redirectUri: string;
}

// Верификация email
export interface EmailVerificationRequest {
  token: string;
}

// Состояние загрузки для различных операций
export interface AuthLoadingStates {
  login: boolean;
  register: boolean;
  logout: boolean;
  refresh: boolean;
  changePassword: boolean;
  resetPassword: boolean;
  verifyEmail: boolean;
}





export interface ExtendedUser extends User {
  level?: number;
  sessionsPlayed?: number;
  favoriteGenre?: string;
  avatar?: string;
}
