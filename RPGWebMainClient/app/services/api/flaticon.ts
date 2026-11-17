import { ApiError, BaseApiClient } from './base';

export type FlaticonHit = {
  id: number;
  preview_url: string;
  author_name: string;
  author_url: string;
};

export type FlaticonCredit = {
  author_name: string;
  author_url: string;
};

function siteOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

class FlaticonApi extends BaseApiClient {
  async search(q: string): Promise<{ items: FlaticonHit[] }> {
    const response = await fetch(`${siteOrigin()}/flaticon/search?${new URLSearchParams({ q })}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Не удалось выполнить поиск' }));
      const detail = errorData.detail || errorData.message || 'Не удалось выполнить поиск';
      throw new ApiError(typeof detail === 'string' ? detail : 'Не удалось выполнить поиск', response.status);
    }
    return response.json();
  }

  credits(): Promise<{ items: FlaticonCredit[] }> {
    return this.get('/integrations/flaticon/credits');
  }

  async download(hit: FlaticonHit): Promise<File> {
    const query = new URLSearchParams({ author_name: hit.author_name });
    const response = await fetch(`${siteOrigin()}/flaticon/icons/${hit.id}?${query}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Не удалось скачать иконку' }));
      const detail = errorData.detail || errorData.message || 'Не удалось скачать иконку';
      throw new ApiError(typeof detail === 'string' ? detail : 'Не удалось скачать иконку', response.status);
    }
    const blob = await response.blob();
    return new File([blob], `flaticon-${hit.id}.png`, { type: blob.type || 'image/png' });
  }
}

export const flaticonApi = new FlaticonApi();
