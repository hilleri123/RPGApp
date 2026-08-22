import { refreshAccessToken } from './tokenRefresh';

function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return 'http://app:8000/api';
}

function canRetryWithRefresh(url: string): boolean {
  return !url.includes('/auth/refresh/token')
    && !url.includes('/auth/login')
    && !url.includes('/auth/telegram')
    && !url.includes('/auth/logout');
}
interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class BaseApiClient {
  protected baseURL: string;
  protected defaultTimeout: number = 10000;
  protected defaultRetries: number = 0;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || resolveApiBaseUrl();
  }

  protected async request<T>(
    endpoint: string, 
    config: RequestConfig = {},
    content_is_json: boolean = true
  ): Promise<T> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = 1000,
      ...requestConfig
    } = config;

    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      // ...(token && { Authorization: `Bearer ${token}` }),
      ...(requestConfig.headers as Record<string, string>),
    };
    
    if (content_is_json) {
      headers['Content-Type'] = 'application/json';
    }
    
    const requestOptions: RequestInit = {
      ...requestConfig,
      headers,
      credentials: 'include',
    };
    
    return this.executeWithRetry(url, requestOptions, retries, retryDelay, true, timeout);
  }

  private async executeWithRetry<T>(
    url: string, 
    options: RequestInit, 
    retries: number,
    delay: number,
    allowRefresh: boolean,
    timeout: number,
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401 && allowRefresh && canRetryWithRefresh(url)) {
            try {
              await refreshAccessToken(this.baseURL);
              return this.executeWithRetry(url, options, retries, delay, false, timeout);
            } catch {
              // refresh не удался — отдаём 401 как обычно
            }
          }

          const errorData = await response.json().catch(() => ({ 
            message: 'Неизвестная ошибка сервера' 
          }));
          
          throw new ApiError(
            errorData.detail || errorData.message || `HTTP error! status: ${response.status}`,
            response.status,
            errorData.code,
            errorData
          );
        }
        if (response.status == 204)
          return null as T;

        return await response.json();
      } catch (error) {
        if (attempt === retries) {
          if (error instanceof ApiError) {
            throw error;
          }
          throw new ApiError('Ошибка сети', 0, 'NETWORK_ERROR');
        }

        // Ждем перед повторной попыткой
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }

    throw new ApiError('Максимальное количество попыток превышено', 0, 'MAX_RETRIES');
  }

  protected buildQuery(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }

  // CRUD методы
  protected async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const query = params ? this.buildQuery(params) : '';
    return this.request<T>(`${endpoint}${query}`, { method: 'GET' });
  }

  protected async post<T>(endpoint: string, data?: any, params?: Record<string, any>): Promise<T> {
    const query = params ? this.buildQuery(params) : '';
    return this.request<T>(`${endpoint}${query}`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected async put<T>(endpoint: string, data?: any, params?: Record<string, any>): Promise<T> {
    const query = params ? this.buildQuery(params) : '';
    return this.request<T>(`${endpoint}${query}`, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected async patch<T>(endpoint: string, data?: any, params?: Record<string, any>): Promise<T> {
    const query = params ? this.buildQuery(params) : '';
    return this.request<T>(`${endpoint}${query}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected async delete<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const query = params ? this.buildQuery(params) : '';
    return this.request<T>(`${endpoint}${query}`, { method: 'DELETE' });
  }

  protected async postMultipart<T>(
    endpoint: string,
    formData: FormData,
    params?: Record<string, any>
  ): Promise<T> {
    const query = params ? this.buildQuery(params) : '';
    return this.request<T>(
      `${endpoint}${query}`,
      { method: 'POST', body: formData },
      false // content_is_json = false => не ставим Content-Type: application/json
    );
  }

  protected async putMultipart<T>(
    endpoint: string,
    formData: FormData,
    params?: Record<string, any>
  ): Promise<T> {
    const query = params ? this.buildQuery(params) : '';
    return this.request<T>(
      `${endpoint}${query}`,
      { method: 'PUT', body: formData },
      false
    );
  }

  /**
   * GET для schema-эндпоинтов: поддерживает 304 и refresh access token при 401
   * (обычный request() не обрабатывает 304 и не всегда подходит для If-None-Match).
   */
  protected async fetchEntitySchemaGet(
    endpoint: string,
    etag?: string,
  ): Promise<{ schema: any; etag?: string; notModified: boolean }> {
    const headers: Record<string, string> = {};
    if (etag) headers['If-None-Match'] = etag;

    const url = `${this.baseURL}${endpoint}`;

    const doFetch = () =>
      fetch(url, { method: 'GET', headers: { ...headers }, credentials: 'include' });

    let response = await doFetch();

    if (response.status === 401 && canRetryWithRefresh(url)) {
      try {
        await refreshAccessToken(this.baseURL);
        response = await doFetch();
      } catch {
        // refresh failed — fall through to error handling below
      }
    }

    if (response.status === 304) {
      return { schema: null as any, etag, notModified: true };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Schema load failed' }));
      throw new ApiError(
        errorData.detail || errorData.message || `HTTP ${response.status}`,
        response.status,
      );
    }

    const schema = await response.json();
    return {
      schema,
      etag: response.headers.get('etag') ?? undefined,
      notModified: false,
    };
  }

  protected async download(endpoint: string, params?: Record<string, any>): Promise<{ blob: Blob; filename: string }> {
    const query = params ? this.buildQuery(params) : '';
    const url = `${this.baseURL}${endpoint}${query}`;

    const headers: Record<string, string> = {
      accept: 'application/octet-stream',
      // ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(url, { method: 'GET', headers, credentials: 'include' });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Ошибка загрузки файла' }));
      throw new ApiError(
        errorData.detail || errorData.message || `HTTP error! status: ${response.status}`,
        response.status,
      );
    }

    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/i);
    const filename = match?.[1] || 'download';

    const blob = await response.blob();
    return { blob, filename };
  }


}



export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type { ApiResponse, RequestConfig };
