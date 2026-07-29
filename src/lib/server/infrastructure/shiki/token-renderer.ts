/**
 * DiffScribe — Shiki Token Renderer
 *
 * Transforms Shiki syntax tokens into safe HTML spans.
 * Known Shiki CSS custom properties (--shiki-light, --shiki-dark,
 * --shiki-font-weight) are rendered inside a style attribute as CSS
 * declarations so the browser can compute them. A stable data-shiki-token
 * marker attribute enables global CSS theme application.
 * Arbitrary CSS keys are rejected to prevent content injection.
 */

export interface ShikiToken {
  content: string;
  htmlAttrs?: Record<string, string>;
}

/** CSS custom property keys that Shiki emits and we accept. */
const ACCEPTED_SHIKI_KEYS = new Set(['--shiki-light', '--shiki-dark', '--shiki-font-weight']);

/**
 * Checks whether a CSS value is safe to embed in a double-quoted HTML
 * attribute. Rejects values containing `"`, `'`, or `;` which could be
 * used to break out of the attribute or inject additional CSS declarations.
 */
function isSafeCssValue(value: string): boolean {
  return !/["';]/.test(value);
}

/**
 * Filters htmlAttrs to accepted Shiki keys, validates values, and returns
 * a CSS declaration string suitable for a `style` attribute. Returns
 * undefined when no accepted keys pass validation.
 */
function shikiAttrsToStyle(attrs: Record<string, string>): string | undefined {
  const pairs = Object.entries(attrs)
    .filter(([key]) => ACCEPTED_SHIKI_KEYS.has(key))
    .filter(([, value]) => isSafeCssValue(value));

  if (pairs.length === 0) return undefined;

  return pairs.map(([key, value]) => `${key}: ${value}`).join('; ');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTokensToHtml(tokens: ShikiToken[]): string {
  return tokens
    .map((token) => {
      const escaped = escapeHtml(token.content);
      const parts: string[] = ['data-shiki-token'];

      if (token.htmlAttrs) {
        const styleStr = shikiAttrsToStyle(token.htmlAttrs);
        if (styleStr) {
          parts.push(`style="${styleStr}"`);
        }
      }

      const attrs = parts.length > 0 ? ` ${parts.join(' ')}` : '';
      return `<span${attrs}>${escaped}</span>`;
    })
    .join('');
}
