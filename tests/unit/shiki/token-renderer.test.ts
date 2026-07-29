import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  renderTokensToHtml,
} from '../../../src/lib/server/infrastructure/shiki/token-renderer';

describe('token-renderer', () => {
  describe('escapeHtml', () => {
    it('escapes < to &lt;', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes > to &gt;', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes & to &amp;', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('escapes " to &quot;', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it("escapes ' to &#039;", () => {
      expect(escapeHtml("don't")).toBe('don&#039;t');
    });

    it('escapes XSS payload', () => {
      const payload = '<script>alert(1)</script>';
      const escaped = escapeHtml(payload);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
    });

    it('returns empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('renderTokensToHtml', () => {
    // ──── Shiki dual-theme tests (real-world usage) ────

    it('adds data-shiki-token marker attribute for Shiki tokens', () => {
      const tokens = [
        {
          content: 'const',
          htmlAttrs: { '--shiki-light': '#D32F2F', '--shiki-dark': '#F97583' },
        },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('data-shiki-token');
    });

    it('renders --shiki-light and --shiki-dark as CSS variables in style attribute', () => {
      const tokens = [
        {
          content: 'const',
          htmlAttrs: { '--shiki-light': '#D32F2F', '--shiki-dark': '#F97583' },
        },
      ];
      const result = renderTokensToHtml(tokens);
      // Style attribute must contain the CSS custom properties as CSS declarations
      expect(result).toContain('style="');
      expect(result).toContain('--shiki-light: #D32F2F');
      expect(result).toContain('--shiki-dark: #F97583');
    });

    it('does not produce --shiki-* as inert HTML attributes', () => {
      const tokens = [
        {
          content: 'const',
          htmlAttrs: { '--shiki-light': '#D32F2F', '--shiki-dark': '#F97583' },
        },
      ];
      const result = renderTokensToHtml(tokens);
      // --shiki-light should NOT appear as an HTML attribute (key="value" outside style)
      // It should only appear inside the style attribute value
      expect(result).toMatch(/style=["']--shiki-light/);
    });

    it('rejects arbitrary CSS properties and only accepts known Shiki keys', () => {
      const tokens = [
        {
          content: 'const',
          htmlAttrs: {
            '--shiki-light': '#D32F2F',
            '--shiki-dark': '#F97583',
            color: 'red',
            background: 'blue',
          },
        },
      ];
      const result = renderTokensToHtml(tokens);
      // Known Shiki keys should be in style
      expect(result).toContain('--shiki-light');
      expect(result).toContain('--shiki-dark');
      // Arbitrary CSS keys should NOT appear
      expect(result).not.toContain('color: red');
      expect(result).not.toContain('background: blue');
    });

    it('preserves --shiki-font-weight when present', () => {
      const tokens = [
        {
          content: 'fn',
          htmlAttrs: {
            '--shiki-light': '#D32F2F',
            '--shiki-dark': '#F97583',
            '--shiki-font-weight': 'bold',
          },
        },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('--shiki-font-weight: bold');
    });

    it('sanitizes values with dangerous characters', () => {
      const tokens = [
        {
          content: 'bad',
          htmlAttrs: {
            '--shiki-light': '#D32F2F"; color: red',
          },
        },
      ];
      const result = renderTokensToHtml(tokens);
      // The value with a quote should be excluded from the style
      expect(result).not.toContain('color: red');
    });

    it('still escapes HTML content when using Shiki attributes', () => {
      const tokens = [
        {
          content: '<div>',
          htmlAttrs: { '--shiki-light': '#FF0000', '--shiki-dark': '#FF5555' },
        },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('&lt;div&gt;');
      expect(result).not.toContain('<div>');
    });

    it('renders empty style when no valid Shiki keys present', () => {
      const tokens = [{ content: 'text', htmlAttrs: { color: 'red', background: 'blue' } }];
      const result = renderTokensToHtml(tokens);
      // Should have marker but no style attribute with arbitrary keys
      expect(result).toContain('data-shiki-token');
      expect(result).not.toContain('color: red');
      expect(result).not.toContain('background: blue');
    });

    // ──── Legacy / edge-case tests ────

    it('renders single token with Shiki colors', () => {
      const tokens = [
        {
          content: 'const',
          htmlAttrs: { '--shiki-light': '#D32F2F', '--shiki-dark': '#F97583' },
        },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('const');
    });

    it('renders multiple tokens', () => {
      const tokens: Array<{ content: string; htmlAttrs?: Record<string, string> }> = [
        {
          content: 'const',
          htmlAttrs: { '--shiki-light': '#D32F2F', '--shiki-dark': '#F97583' },
        },
        { content: ' ', htmlAttrs: {} },
        {
          content: 'x',
          htmlAttrs: { '--shiki-light': '#1976D2', '--shiki-dark': '#79B8FF' },
        },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('const');
      expect(result).toContain('x');
    });

    it('escapes token content', () => {
      const tokens = [
        {
          content: '<div>',
          htmlAttrs: { '--shiki-light': '#D32F2F', '--shiki-dark': '#F97583' },
        },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('&lt;div&gt;');
      expect(result).not.toContain('<div>');
    });

    it('renders empty string for empty tokens', () => {
      const result = renderTokensToHtml([]);
      expect(result).toBe('');
    });

    it('renders token with htmlAttrs undefined', () => {
      const tokens = [{ content: 'plain' }];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('plain');
    });
  });
});
