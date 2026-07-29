export interface ShikiToken {
  content: string;
  htmlAttrs?: Record<string, string>;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ');
}

export function renderTokensToHtml(tokens: ShikiToken[]): string {
  return tokens
    .map((token) => {
      const escaped = escapeHtml(token.content);
      const attrs = token.htmlAttrs ? ` ${attrsToString(token.htmlAttrs)}` : '';
      return `<span${attrs}>${escaped}</span>`;
    })
    .join('');
}
