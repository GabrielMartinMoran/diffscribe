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
    it('renders single token with color', () => {
      const tokens: Array<{ content: string; htmlAttrs?: Record<string, string> }> = [
        { content: 'const', htmlAttrs: { style: 'color: #0000FF' } },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('<span style="color: #0000FF">');
      expect(result).toContain('const');
    });

    it('renders multiple tokens', () => {
      const tokens: Array<{ content: string; htmlAttrs?: Record<string, string> }> = [
        { content: 'const', htmlAttrs: { style: 'color: #0000FF' } },
        { content: ' ', htmlAttrs: {} },
        { content: 'x', htmlAttrs: { style: 'color: #000000' } },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('<span style="color: #0000FF">const</span>');
      expect(result).toContain('<span > </span>');
      expect(result).toContain('<span style="color: #000000">x</span>');
    });

    it('escapes token content', () => {
      const tokens: Array<{ content: string; htmlAttrs?: Record<string, string> }> = [
        { content: '<div>', htmlAttrs: { style: 'color: red' } },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('&lt;div&gt;');
      expect(result).not.toContain('<div>');
    });

    it('renders empty string for empty tokens', () => {
      const result = renderTokensToHtml([]);
      expect(result).toBe('');
    });

    it('renders multple html attributes', () => {
      const tokens: Array<{ content: string; htmlAttrs?: Record<string, string> }> = [
        { content: 'foo', htmlAttrs: { style: 'color: red', class: 'token keyword' } },
      ];
      const result = renderTokensToHtml(tokens);
      expect(result).toContain('style="color: red"');
      expect(result).toContain('class="token keyword"');
    });
  });
});
