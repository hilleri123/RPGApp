let refreshPromise: Promise<void> | null = null;

export async function refreshAccessToken(baseURL: string): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${baseURL}/auth/refresh/token`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Не удалось обновить токен');
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
