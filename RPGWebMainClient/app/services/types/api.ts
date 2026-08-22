// Базовые API типы
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, any>;
  field?: string;
}

// Параметры запросов
export interface PaginationParams {
  skip?: number;
  limit?: number;
  page?: number;
}

export interface SearchParams {
  search?: string;
  query?: string;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: string | number | boolean | undefined | null;
}

export type QueryParams = PaginationParams & SearchParams & SortParams & FilterParams;

// Стандартные операции CRUD
export interface CrudOperations<T, TCreate, TUpdate = Partial<TCreate>> {
  getAll(params?: QueryParams): Promise<T[]>;
  getById(id: string | string): Promise<T>;
  create(data: TCreate): Promise<T>;
  update(id: string | string, data: TUpdate): Promise<T>;
  delete(id: string | string): Promise<void>;
}

// Bulk операции
export interface BulkOperations<T, TCreate> {
  bulkCreate(items: TCreate[]): Promise<T[]>;
  bulkUpdate(updates: Array<{ id: string | string; data: Partial<TCreate> }>): Promise<T[]>;
  bulkDelete(ids: (number | string)[]): Promise<void>;
}

// Метаданные ответа
export interface ResponseMetadata {
  timestamp: string;
  version: string;
  requestId?: string;
}

// Типы HTTP методов
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Конфигурация запроса
export interface RequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  params?: QueryParams;
}

// Типы ошибок API
export type ApiErrorType = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

// Расширенная ошибка API
export interface ExtendedApiError extends ApiError {
  type: ApiErrorType;
  timestamp: string;
  path?: string;
  method?: HttpMethod;
}
