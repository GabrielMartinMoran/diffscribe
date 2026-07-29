<script lang="ts">
  import { Moon, Sun } from 'svelte-lucide';

  import {
    applyThemeToDocument,
    readStoredTheme,
    resolveThemeKey,
    type ThemeKey,
    writeStoredTheme,
  } from '$lib/web/stores/theme-store';

  let currentTheme = $state<ThemeKey>(
    resolveThemeKey(readStoredTheme(typeof localStorage !== 'undefined' ? localStorage : null)),
  );

  // Apply theme on mount and when it changes
  $effect(() => {
    applyThemeToDocument(currentTheme, typeof document !== 'undefined' ? document : null);
  });

  function setTheme(key: ThemeKey) {
    currentTheme = key;
    writeStoredTheme(key, typeof localStorage !== 'undefined' ? localStorage : null);
  }
</script>

<div
  data-testid="theme-switcher"
  class="theme-switcher"
  role="radiogroup"
  aria-label="Theme selection"
>
  <button
    role="radio"
    aria-checked={currentTheme === 'dark'}
    aria-label="Dark Deep"
    data-testid="theme-dark"
    class="theme-btn"
    class:active={currentTheme === 'dark'}
    onclick={() => setTheme('dark')}
  >
    <Moon size="16" strokeWidth="1.5" ariaLabel="Dark Deep" />
    <span class="theme-label">Dark Deep</span>
  </button>
  <button
    role="radio"
    aria-checked={currentTheme === 'synthwave-84'}
    aria-label="Synthwave '84"
    data-testid="theme-synthwave"
    class="theme-btn"
    class:active={currentTheme === 'synthwave-84'}
    onclick={() => setTheme('synthwave-84')}
  >
    <Sun size="16" strokeWidth="1.5" ariaLabel="Synthwave '84" />
    <span class="theme-label">Synthwave '84</span>
  </button>
</div>

<style>
  .theme-switcher {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-primary);
  }

  .theme-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s,
      border-color 0.15s;
  }

  .theme-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .theme-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 1px;
  }

  .theme-btn.active {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-light, rgba(66, 133, 244, 0.1));
  }

  .theme-label {
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .theme-btn {
      transition: none;
    }
  }
</style>
