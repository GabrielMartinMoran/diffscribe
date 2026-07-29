import { describe, expect, it } from 'vitest';

import { resolveLanguage } from '../../../src/lib/server/infrastructure/shiki/language-map';

describe('language-map', () => {
  describe('resolveLanguage', () => {
    it('resolves .ts to typescript', () => {
      expect(resolveLanguage('src/app.ts')).toBe('typescript');
    });

    it('resolves .tsx to tsx', () => {
      expect(resolveLanguage('src/Component.tsx')).toBe('tsx');
    });

    it('resolves .js to javascript', () => {
      expect(resolveLanguage('src/app.js')).toBe('javascript');
    });

    it('resolves .jsx to jsx', () => {
      expect(resolveLanguage('src/Component.jsx')).toBe('jsx');
    });

    it('resolves .svelte to svelte', () => {
      expect(resolveLanguage('Component.svelte')).toBe('svelte');
    });

    it('resolves .py to python', () => {
      expect(resolveLanguage('src/main.py')).toBe('python');
    });

    it('resolves .rs to rust', () => {
      expect(resolveLanguage('src/lib.rs')).toBe('rust');
    });

    it('resolves .go to go', () => {
      expect(resolveLanguage('src/main.go')).toBe('go');
    });

    it('resolves .rb to ruby', () => {
      expect(resolveLanguage('src/app.rb')).toBe('ruby');
    });

    it('resolves .java to java', () => {
      expect(resolveLanguage('src/App.java')).toBe('java');
    });

    it('resolves .kt to kotlin', () => {
      expect(resolveLanguage('src/App.kt')).toBe('kotlin');
    });

    it('resolves .swift to swift', () => {
      expect(resolveLanguage('src/App.swift')).toBe('swift');
    });

    it('resolves .c to c', () => {
      expect(resolveLanguage('src/main.c')).toBe('c');
    });

    it('resolves .h to c', () => {
      expect(resolveLanguage('src/header.h')).toBe('c');
    });

    it('resolves .cpp to cpp', () => {
      expect(resolveLanguage('src/main.cpp')).toBe('cpp');
    });

    it('resolves .cc to cpp', () => {
      expect(resolveLanguage('src/main.cc')).toBe('cpp');
    });

    it('resolves .hpp to cpp', () => {
      expect(resolveLanguage('src/header.hpp')).toBe('cpp');
    });

    it('resolves .cs to csharp', () => {
      expect(resolveLanguage('src/App.cs')).toBe('csharp');
    });

    it('resolves .json to json', () => {
      expect(resolveLanguage('data/config.json')).toBe('json');
    });

    it('resolves .yaml to yaml', () => {
      expect(resolveLanguage('config.yaml')).toBe('yaml');
    });

    it('resolves .yml to yaml', () => {
      expect(resolveLanguage('config.yml')).toBe('yaml');
    });

    it('resolves .md to markdown', () => {
      expect(resolveLanguage('docs/README.md')).toBe('markdown');
    });

    it('resolves .html to html', () => {
      expect(resolveLanguage('src/index.html')).toBe('html');
    });

    it('resolves .css to css', () => {
      expect(resolveLanguage('src/styles.css')).toBe('css');
    });

    it('resolves .scss to scss', () => {
      expect(resolveLanguage('src/styles.scss')).toBe('scss');
    });

    it('resolves .less to less', () => {
      expect(resolveLanguage('src/styles.less')).toBe('less');
    });

    it('resolves .sql to sql', () => {
      expect(resolveLanguage('src/query.sql')).toBe('sql');
    });

    it('resolves .sh to shellscript', () => {
      expect(resolveLanguage('scripts/build.sh')).toBe('shellscript');
    });

    it('resolves .bash to shellscript', () => {
      expect(resolveLanguage('scripts/setup.bash')).toBe('shellscript');
    });

    it('resolves .toml to toml', () => {
      expect(resolveLanguage('Cargo.toml')).toBe('toml');
    });

    it('resolves .xml to xml', () => {
      expect(resolveLanguage('config.xml')).toBe('xml');
    });

    it('resolves .graphql to graphql', () => {
      expect(resolveLanguage('src/query.graphql')).toBe('graphql');
    });

    it('resolves .gql to graphql', () => {
      expect(resolveLanguage('src/query.gql')).toBe('graphql');
    });

    it('resolves .vue to vue', () => {
      expect(resolveLanguage('src/App.vue')).toBe('vue');
    });

    it('resolves .php to php', () => {
      expect(resolveLanguage('src/index.php')).toBe('php');
    });

    it('resolves .dart to dart', () => {
      expect(resolveLanguage('src/app.dart')).toBe('dart');
    });

    it('resolves .lua to lua', () => {
      expect(resolveLanguage('src/init.lua')).toBe('lua');
    });

    it('resolves .r to r', () => {
      expect(resolveLanguage('src/analysis.r')).toBe('r');
    });

    it('resolves unknown extension to text', () => {
      expect(resolveLanguage('data/unknown.xyz')).toBe('text');
    });

    it('resolves no extension to text', () => {
      expect(resolveLanguage('Makefile')).toBe('text');
    });

    it('resolves dotfile to text', () => {
      expect(resolveLanguage('.gitignore')).toBe('text');
    });

    it('resolves upper-case extension case-insensitively', () => {
      expect(resolveLanguage('src/App.TS')).toBe('typescript');
    });

    it('resolves mixed-case extension case-insensitively', () => {
      expect(resolveLanguage('src/App.Ts')).toBe('typescript');
    });
  });
});
