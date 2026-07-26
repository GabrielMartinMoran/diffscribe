import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('smoke — integration', () => {
  it('svelte.config.js exists and has kit config', async () => {
    const configPath = resolve(import.meta.dirname, '../../svelte.config.js');
    expect(existsSync(configPath)).toBe(true);

    const mod = await import(configPath);
    const loaded = mod.default ?? mod;
    expect(loaded.kit).toBeDefined();
  });

  it('Clean Architecture skeleton directories exist', () => {
    const skeletonDirs = [
      'src/lib/server/domain/entities',
      'src/lib/server/domain/value-objects',
      'src/lib/server/domain/repositories',
      'src/lib/server/domain/errors',
      'src/lib/server/application/dto/commands',
      'src/lib/server/application/dto/queries',
      'src/lib/server/application/dto/results',
      'src/lib/server/application/services',
      'src/lib/server/infrastructure/repositories',
      'src/lib/server/infrastructure/mappers',
      'src/lib/server/infrastructure/git',
      'src/lib/server/infrastructure/database',
      'src/lib/web/components',
      'src/lib/web/stores',
    ];

    for (const dir of skeletonDirs) {
      const fullPath = resolve(import.meta.dirname, '../..', dir);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  it('design tokens file exists', () => {
    const tokensPath = resolve(import.meta.dirname, '../../src/lib/web/styles/tokens.css');
    expect(existsSync(tokensPath)).toBe(true);
  });

  it('app.html has lang="es"', () => {
    const htmlPath = resolve(import.meta.dirname, '../../src/app.html');
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('lang="es"');
  });
});
