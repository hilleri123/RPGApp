// app/lib/htmlPreview.ts
export type HtmlPreviewOptions = {
  /** Если true — вход считаем HTML (и достаём textContent через DOMParser). */
  treatAsHtml?: boolean;

  /** Максимальная длина результата. Если не задано — не обрезаем. */
  maxLen?: number;

  /** Обрезать по границе слова (чтобы не рубить слово посередине). */
  wordBoundary?: boolean;

  /** Суффикс при обрезке. */
  ellipsis?: string;
};

function stripHtmlToText(html: string): string {
  // работает в браузере/Next client-components
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxLen: number, wordBoundary: boolean, ellipsis: string): string {
  if (text.length <= maxLen) return text;

  const limit = Math.max(0, maxLen - ellipsis.length);
  if (limit <= 0) return ellipsis.slice(0, maxLen);

  let cut = text.slice(0, limit);

  if (wordBoundary) {
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 20) cut = cut.slice(0, lastSpace); // небольшая защита от "обрезали почти всё"
  }

  return cut.trimEnd() + ellipsis;
}

/**
 * Делает безопасное превью для карточек/таблиц:
 * HTML -> plain text -> (опционально) обрезка.
 */
export function makeTextPreview(input: string | null | undefined, opts: HtmlPreviewOptions = {}): string {
  const {
    treatAsHtml = true,
    maxLen,
    wordBoundary = true,
    ellipsis = '…',
  } = opts;

  if (!input) return '—';

  const text = treatAsHtml ? stripHtmlToText(input) : String(input).replace(/\s+/g, ' ').trim();
  if (!text) return '—';

  if (typeof maxLen === 'number') {
    return truncateText(text, maxLen, wordBoundary, ellipsis);
  }

  return text;
}
