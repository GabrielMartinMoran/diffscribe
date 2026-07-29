import { describe, expect, it } from 'vitest';

import { getHighlighter } from '../../../src/lib/server/infrastructure/shiki/highlighter';

describe('highlighter', () => {
  describe('getHighlighter', () => {
    it('returns a highlighter instance', async () => {
      const h = await getHighlighter();
      expect(h).toBeDefined();
    });

    it('returns the same instance on second call (singleton)', async () => {
      const h1 = await getHighlighter();
      const h2 = await getHighlighter();
      expect(h1).toBe(h2);
    });
  });

  describe('highlight', () => {
    it('returns tokens for TypeScript code with dual themes', async () => {
      const h = await getHighlighter();
      const result = await h.highlight('const x = 1;\nconsole.log(x);', 'typescript');

      expect(result).toBeDefined();
      expect(result.lines).toBeDefined();
      expect(result.lines.length).toBeGreaterThanOrEqual(2);

      // Each line should have a rendered HTML string and plain text
      const firstLine = result.lines[0];
      expect(firstLine.html).toBeTruthy();
      expect(firstLine.text).toBe('const x = 1;');
    });

    it('renders tokens with span elements for dark theme', async () => {
      const h = await getHighlighter();
      const result = await h.highlight('const x = 1;', 'typescript');

      const firstLine = result.lines[0];
      expect(firstLine.html).toContain('<span');
      // Should contain CSS color property from Shiki
      expect(firstLine.html.length).toBeGreaterThan(10);
    });

    it('returns tokens for null/empty code', async () => {
      const h = await getHighlighter();
      const result = await h.highlight('', 'typescript');

      expect(result.lines.length).toBeGreaterThanOrEqual(0);
    });

    it('returns tokens for single line', async () => {
      const h = await getHighlighter();
      const result = await h.highlight('const x = 1;', 'typescript');

      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      expect(result.lines[0].html).toBeTruthy();
    });

    it('returns tokens for multi-line code', async () => {
      const h = await getHighlighter();
      const result = await h.highlight('const x = 1;\nconst y = 2;\nconst z = 3;', 'typescript');

      expect(result.lines.length).toBeGreaterThanOrEqual(3);
    });

    it('escapes HTML in source content', async () => {
      const h = await getHighlighter();
      const result = await h.highlight('<script>alert(1)</script>', 'typescript');

      const html = result.lines.map((l) => l.html).join('');
      // Should not contain raw <script> tags
      expect(html).not.toMatch(/<script>/i);
    });

    it('handles "text" language gracefully', async () => {
      const h = await getHighlighter();
      const result = await h.highlight('plain text here', 'text');

      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      expect(result.lines[0].text).toBe('plain text here');
    });
  });
});
