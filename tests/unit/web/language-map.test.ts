import { describe, expect, it } from 'vitest';

import { resolveLanguage as clientResolve } from '$lib/web/utils/language-map';

import { resolveLanguage as serverResolve } from '../../../src/lib/server/infrastructure/shiki/language-map';

describe('client language-map parity', () => {
  const samples = [
    'README.md',
    'docs/guide.markdown',
    'src/app.ts',
    'src/app.tsx',
    'main.js',
    'main.mjs',
    'Component.svelte',
    'script.py',
    'main.rs',
    'go.mod',
    'main.go',
    'test.rb',
    'Main.java',
    'App.kt',
    'App.kts',
    'main.swift',
    'a.c',
    'a.h',
    'a.cpp',
    'a.cc',
    'a.hpp',
    'a.cs',
    'data.json',
    'config.yaml',
    'config.yml',
    'index.html',
    'index.htm',
    'style.css',
    'style.scss',
    'style.less',
    'query.sql',
    'deploy.sh',
    'run.bash',
    'run.zsh',
    'Cargo.toml',
    'feed.xml',
    'schema.graphql',
    'query.gql',
    'App.vue',
    'index.php',
    'main.dart',
    'main.lua',
    'main.r',
    'noext',
    'README',
    'archive.tar.gz',
    'UPPER.MD',
  ];

  it('matches the server resolveLanguage for every known extension', () => {
    for (const file of samples) {
      expect(clientResolve(file)).toBe(serverResolve(file));
    }
  });
});
