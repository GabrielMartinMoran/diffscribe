import { describe, expect, it } from 'vitest';

import { renderMarkdown, sanitizeLink } from '$lib/web/utils/markdown-renderer';

describe('sanitizeLink', () => {
  it('allows http and https URLs', () => {
    expect(sanitizeLink('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(sanitizeLink('http://example.com')).toBe('http://example.com');
  });

  it('allows mailto links', () => {
    expect(sanitizeLink('mailto:test@example.com')).toBe('mailto:test@example.com');
  });

  it('rejects javascript: links', () => {
    expect(sanitizeLink('javascript:alert(1)')).toBeNull();
    expect(sanitizeLink('JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('rejects vbscript and data URLs', () => {
    expect(sanitizeLink('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeLink('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
  });

  it('rejects protocol-relative and bare schemes', () => {
    expect(sanitizeLink('//example.com')).toBeNull();
    expect(sanitizeLink('file:///etc/passwd')).toBeNull();
  });

  it('rejects whitespace-prefixed javascript', () => {
    expect(sanitizeLink(' javascript:alert(1)')).toBeNull();
  });

  it('rejects empty and null input', () => {
    expect(sanitizeLink('')).toBeNull();
    expect(sanitizeLink(null as unknown as string)).toBeNull();
  });
});

describe('renderMarkdown', () => {
  it('renders headings, paragraphs, and emphasis', () => {
    const html = renderMarkdown('# Title\n\nHello **bold** and *italic*.');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders fenced code blocks with escaped content', () => {
    const html = renderMarkdown('```ts\nconst x = 1 < 2;\n```');
    expect(html).toContain('<pre><code>');
    expect(html).toContain('const x = 1 &lt; 2;');
    expect(html).not.toContain('<script');
  });

  it('escapes raw HTML in source', () => {
    const html = renderMarkdown('Before <script>alert(1)</script> after');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes event handler attributes', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    // The raw tag never renders; the source is shown as escaped text.
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders javascript: links as plain text, not anchors', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('<a ');
    expect(html).toContain('javascript:alert(1)');
  });

  it('renders safe links as anchors', () => {
    const html = renderMarkdown('[docs](https://example.com)');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('escapes link text', () => {
    const html = renderMarkdown('[<b>x</b>](https://example.com)');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('renders inline code escaped', () => {
    const html = renderMarkdown('Use `code <tag>` here');
    expect(html).toContain('<code>code &lt;tag&gt;</code>');
  });

  it('renders lists and blockquotes', () => {
    const html = renderMarkdown('- one\n- two\n\n> quote');
    expect(html).toContain('<ul>');
    expect(html).toContain('<blockquote>');
  });

  it('renders thematic breaks', () => {
    const html = renderMarkdown('a\n\n---\n\nb');
    expect(html).toContain('<hr');
  });

  it('handles adversarial deep nesting without throwing', () => {
    const nested = '# '.repeat(50) + 'deep';
    expect(() => renderMarkdown(nested)).not.toThrow();
  });

  it('handles long fences without unbounded output', () => {
    const long = '```\n' + 'line\n'.repeat(5000) + '```';
    const html = renderMarkdown(long);
    expect(html.length).toBeLessThan(50_000);
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
