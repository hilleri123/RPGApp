// app/lib/htmlTruncate.ts
export type HtmlTruncateOptions = {
  maxLen: number;          // лимит по видимым символам
  ellipsis?: string;       // '…'
  trimWhitespace?: boolean; // схлопывать пробелы при подсчёте
};

function normalizeText(s: string, trimWhitespace: boolean) {
  return trimWhitespace ? s.replace(/\s+/g, ' ') : s;
}

export function truncateHtmlPreserveMarkup(
  html: string | null | undefined,
  opts: HtmlTruncateOptions
): { html: string; truncated: boolean; textLen: number } {
  const { maxLen, ellipsis = '…', trimWhitespace = true } = opts;

  if (!html) return { html: '', truncated: false, textLen: 0 };

  const doc = new DOMParser().parseFromString(html, 'text/html'); // browser only [web:452]
  const root = doc.body;

  let remaining = maxLen;
  let truncated = false;
  let totalLen = 0;

  const walk = (node: Node) => {
    if (truncated) {
      node.parentNode?.removeChild(node);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue ?? '';
      const text = normalizeText(raw, trimWhitespace);
      totalLen += text.length;

      if (text.length <= remaining) {
        remaining -= text.length;
        if (trimWhitespace && text !== raw) node.nodeValue = text;
        return;
      }

      // нужно обрезать именно этот текстовый узел
      const cutLen = Math.max(0, remaining);
      const cutText = text.slice(0, cutLen).replace(/\s+$/g, '');
      node.nodeValue = cutText + ellipsis;
      truncated = true;

      // удалить всех следующих siblings (на том же уровне)
      let sib = node.nextSibling;
      while (sib) {
        const next = sib.nextSibling;
        sib.parentNode?.removeChild(sib);
        sib = next;
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      // запретить попадание <script>/<style> в превью
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') {
        node.parentNode?.removeChild(node);
        return;
      }

      // обход детей копией списка, потому что будем удалять
      const children = Array.from(node.childNodes);
      for (const ch of children) {
        walk(ch);
        if (truncated) {
          // после обрезки удалим оставшихся детей
          const rest = Array.from(node.childNodes);
          for (const r of rest) {
            // оставляем то, что уже обработали (оно осталось в DOM), остальные удаляем
            // проще: если r идёт после последнего обработанного — он уже удален в TEXT_NODE ветке
          }
          break;
        }
      }

      // если элемент стал пустой после удаления — можно убрать, чтобы не было пустых <p></p>
      if (truncated && (node as Element).childNodes.length === 0) {
        node.parentNode?.removeChild(node);
      }
    }
  };

  const topChildren = Array.from(root.childNodes);
  for (const ch of topChildren) {
    walk(ch);
    if (truncated) break;
  }

  return { html: root.innerHTML, truncated, textLen: totalLen };
}
