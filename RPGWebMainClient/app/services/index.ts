import { authApiService } from './api/auth';
import { rulesApiService } from './api/rules';

// API Services
export { BaseApiClient, ApiError } from './api/base';
export { authApiService } from './api/auth';
export { rulesApiService } from './api/rules';

// Types - Auth
export type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ExtendedUser,
  LoginFormData,
  RegisterFormData,
  TokenData,
  AuthState,
  AuthContextValue,
  AuthError,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ConfirmResetPasswordRequest,
  ProfileUpdateRequest,
  UserRole,
  UserWithRoles,
  JWTPayload,
  OAuthProvider,
  SocialAuthRequest,
  EmailVerificationRequest,
  AuthLoadingStates
} from './types/auth';

// Types - API
export type {
  ApiResponse,
  PaginatedResponse,
  ApiError as ApiErrorType,
  PaginationParams,
  SearchParams,
  SortParams,
  FilterParams,
  QueryParams,
  CrudOperations,
  BulkOperations,
  ResponseMetadata,
  HttpMethod,
  RequestConfig,
  ApiErrorType as ApiErrorTypeEnum,
  ExtendedApiError
} from './types/api';



// Hooks
export { useApi, useMutation, usePagination } from './hooks/useApi';
export { useAuth } from './hooks/useAuth';

// Utils
// export * from './utils/validators';
// export * from './utils/transformers';

// Создаем единый API объект для удобства
export const api = {
  auth: authApiService,
  rules: rulesApiService,
};
