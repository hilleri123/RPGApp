/**
 * URL рисунка жеста-seed, сохранённого на сервере (MEDIA_ROOT/rolls/<hash>.png).
 * Та же схема, что в журнале бросков: ref вида `rolls/<hash>.png` или просто хэш.
 */
export function seedImageUrl(ref?: string | null, hash?: string | null): string | null {
  if (ref) {
    const path = ref.startsWith('/') ? ref : `/${ref}`;
    if (path.startsWith('/media/')) return `/api${path}`;
    return `/api/media/${ref.replace(/^\//, '')}`;
  }
  if (hash && /^[a-f0-9]{16,64}$/i.test(hash)) return `/api/media/rolls/${hash}.png`;
  return null;
}
