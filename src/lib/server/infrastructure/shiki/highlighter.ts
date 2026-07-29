import {
  type BundledLanguage,
  createHighlighter,
  type Highlighter as ShikiHighlighter,
} from 'shiki';

import { escapeHtml, renderTokensToHtml, type ShikiToken } from './token-renderer';

export interface HighlightedLine {
  html: string;
  text: string;
}

export interface HighlightResult {
  lines: HighlightedLine[];
}

export interface DiffHighlighter {
  highlight(code: string, lang: string): Promise<HighlightResult>;
}

class ShikiDiffHighlighter implements DiffHighlighter {
  private highlighter: ShikiHighlighter | null = null;
  private initPromise: Promise<ShikiHighlighter> | null = null;

  async highlight(code: string, lang: string): Promise<HighlightResult> {
    const h = await this.ensureHighlighter();

    if (!code) {
      return { lines: [{ html: '', text: '' }] };
    }

    // For 'text' language, skip Shiki and render plain escaped text
    if (lang === 'text') {
      const lines = code.split('\n').map((text) => ({
        html: escapeHtml(text),
        text,
      }));
      return { lines };
    }

    try {
      const result = h.codeToTokens(code, {
        lang: lang as BundledLanguage,
        themes: { light: 'min-light', dark: 'min-dark' },
        defaultColor: false,
      });

      const lines: HighlightedLine[] = result.tokens.map((lineTokens) => {
        const ourTokens: ShikiToken[] = lineTokens.map((token) => ({
          content: token.content,
          htmlAttrs: token.htmlStyle,
        }));

        const html = renderTokensToHtml(ourTokens);
        const text = lineTokens.map((t) => t.content).join('');
        return { html, text };
      });

      return { lines };
    } catch {
      // Fallback: render as plain text if highlighting fails
      const lines = code.split('\n').map((text) => ({
        html: escapeHtml(text),
        text,
      }));
      return { lines };
    }
  }

  private async ensureHighlighter(): Promise<ShikiHighlighter> {
    if (this.highlighter) return this.highlighter;

    if (!this.initPromise) {
      this.initPromise = createHighlighter({
        themes: ['min-light', 'min-dark'],
        langs: [
          'javascript',
          'jsx',
          'typescript',
          'tsx',
          'svelte',
          'python',
          'rust',
          'go',
          'ruby',
          'java',
          'kotlin',
          'swift',
          'c',
          'cpp',
          'csharp',
          'json',
          'yaml',
          'markdown',
          'html',
          'css',
          'scss',
          'less',
          'sql',
          'shellscript',
          'toml',
          'xml',
          'graphql',
          'vue',
          'php',
          'dart',
          'lua',
          'r',
        ],
      });
    }

    this.highlighter = await this.initPromise;
    return this.highlighter;
  }
}

let singleton: ShikiDiffHighlighter | null = null;

export async function getHighlighter(): Promise<DiffHighlighter> {
  if (!singleton) {
    singleton = new ShikiDiffHighlighter();
  }
  return singleton;
}
