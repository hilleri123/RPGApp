const SITE = 'https://www.flaticon.com';
const HOME = 'https://www.flaticon.com/ru/free-icons/';
// Прямой вызов контейнера app, мимо nginx. На проде ROOT_PATH пустой, поэтому
// префикс /api здесь не нужен: его срезает только nginx перед uvicorn.
const API = process.env.APP_ORIGIN ?? 'http://app:8000';

const BROWSER = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
};

export function authorPage(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug ? `https://www.flaticon.com/authors/${slug}` : HOME;
}

export function cdnPngUrl(id: number): string {
  return `https://cdn-icons-png.flaticon.com/256/${Math.floor(id / 1000)}/${id}.png`;
}

export async function requireUser(request: Request): Promise<boolean> {
  const cookie = request.headers.get('cookie') || '';
  if (!cookie.includes('access_token=')) return false;
  const me = await fetch(`${API}/users/me`, { headers: { cookie }, cache: 'no-store' });
  return me.ok;
}

export async function searchIcons(term: string) {
  const url = `${SITE}/ajax/search/1?${new URLSearchParams({ word: term })}`;
  const response = await fetch(url, {
    headers: {
      ...BROWSER,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${SITE}/search?word=${encodeURIComponent(term)}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('search failed');
  const payload = await response.json();
  const raw = Array.isArray(payload?.items) ? payload.items : [];
  const items = [];
  for (const item of raw) {
    if (!item || item.id == null) continue;
    const preview = String(item.png || item.png512 || '').replace(/\\\//g, '/');
    if (!preview) continue;
    const author = String(item.team_name || item.teamName || 'Flaticon');
    items.push({
      id: Number(item.id),
      preview_url: preview,
      author_name: author,
      author_url: authorPage(author),
    });
    if (items.length >= 24) break;
  }
  return items;
}

export async function downloadPng(id: number): Promise<ArrayBuffer> {
  const response = await fetch(cdnPngUrl(id), {
    headers: {
      ...BROWSER,
      Accept: 'image/png,image/*;q=0.8',
      Referer: `${SITE}/`,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('download failed');
  return response.arrayBuffer();
}

export async function rememberAuthor(request: Request, iconId: number, authorName: string) {
  const cookie = request.headers.get('cookie') || '';
  await fetch(`${API}/integrations/flaticon/credits`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ icon_id: iconId, author_name: authorName }),
    cache: 'no-store',
  });
}
