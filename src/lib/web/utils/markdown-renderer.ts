/**
 * Dependency-free, strictly escaping Markdown renderer for the source-viewer
 * Preview mode.
 *
 * Security boundary: ALL source input is HTML-escaped before interpolation;
 * raw HTML in the source is never emitted; link URLs are allowlisted
 * (`http:`, `https:`, `mailto:`) via `sanitizeLink`. The returned string is
 * the ONLY content this module ever produces for `{@html}` consumption.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Allowlist a link URL. Returns the URL unchanged for `http:`, `https:`, and
 * `mailto:`; returns null for anything else (javascript:, vbscript:, data:,
 * protocol-relative, file:, whitespace-prefixed, empty).
 */
export function sanitizeLink(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const scheme = trimmed.split(':')[0]?.toLowerCase();
  if (scheme === undefined || scheme === '') return null;
  if (!ALLOWED_PROTOCOLS.includes(`${scheme}:`)) return null;
  return trimmed;
}

function renderInline(text: string): string {
  let result = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    // Inline code: `...`
    if (char === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        const code = text.slice(i + 1, end);
        result += `<code>${escapeHtml(code)}</code>`;
        i = end + 1;
        continue;
      }
    }

    // Links: [text](url)
    if (char === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const label = text.slice(i + 1, closeBracket);
          const rawUrl = text.slice(closeBracket + 2, closeParen);
          const url = sanitizeLink(rawUrl);
          if (url) {
            result += `<a href="${escapeHtml(url)}">${renderInline(label)}</a>`;
            i = closeParen + 1;
            continue;
          }
          // Unsafe URL: render label + literal URL as plain text.
          result += `${renderInline(label)}(${escapeHtml(rawUrl)})`;
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Bold: **text**
    if (char === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        result += `<strong>${renderInline(text.slice(i + 2, end))}</strong>`;
        i = end + 2;
        continue;
      }
    }

    // Italic: *text*
    if (char === '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1) {
        result += `<em>${renderInline(text.slice(i + 1, end))}</em>`;
        i = end + 1;
        continue;
      }
    }

    result += escapeHtml(char);
    i++;
  }

  return result;
}

/**
 * Render the supported Markdown subset to escaped HTML. Supported: ATX
 * headings, paragraphs, bold/italic, inline code, fenced code blocks, links,
 * unordered lists, blockquotes, and thematic breaks. All content is escaped;
 * no raw HTML is ever emitted.
 */
export function renderMarkdown(source: string): string {
  if (!source) return '';

  const normalized = source.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const out: string[] = [];
  let i = 0;
  const len = lines.length;

  // Blank-line normalization: collapse leading blanks.
  while (i < len) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      i++;
      const codeLines: string[] = [];
      while (i < len && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Thematic break
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < len && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      out.push(`<blockquote>${renderInline(quoteLines.join('\n'))}</blockquote>`);
      continue;
    }

    // Unordered list
    const listMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (listMatch) {
      const items: string[] = [renderInline(listMatch[1])];
      i++;
      while (i < len) {
        const next = lines[i].match(/^\s*[-*+]\s+(.*)$/);
        if (!next) break;
        items.push(renderInline(next[1]));
        i++;
      }
      out.push(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      continue;
    }

    // Blank line: paragraph separator
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph: consume until a blank line or block start.
    const paragraph: string[] = [line];
    i++;
    while (i < len) {
      const next = lines[i];
      if (
        next.trim() === '' ||
        /^```/.test(next) ||
        /^#{1,6}\s+/.test(next) ||
        /^\s*[-*+]\s+/.test(next) ||
        next.startsWith('> ')
      ) {
        break;
      }
      paragraph.push(next);
      i++;
    }
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }

  return out.join('\n');
}
