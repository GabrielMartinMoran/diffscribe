<script lang="ts">
  import { browser } from '$app/environment';
  import { readStoredWrap, resolveWrap, writeStoredWrap } from '$lib/web/stores/wrap-store';

  import ThemeSwitcher from './theme-switcher.svelte';
  import Switch from './ui/Switch.svelte';

  let wrapEnabled = $state(false);

  $effect(() => {
    if (!browser) return;
    wrapEnabled = resolveWrap(readStoredWrap(window.localStorage));
  });

  function handleWrapChange() {
    wrapEnabled = !wrapEnabled;
    if (browser) {
      writeStoredWrap(wrapEnabled, window.localStorage);
    }
  }
</script>

<div data-testid="settings-panel" class="settings-panel">
  <section
    data-testid="settings-section-appearance"
    class="settings-section"
    aria-labelledby="settings-appearance-title"
  >
    <h3 id="settings-appearance-title" class="settings-title">Appearance</h3>
    <ThemeSwitcher />
  </section>

  <section
    data-testid="settings-section-editor"
    class="settings-section"
    aria-labelledby="settings-editor-title"
  >
    <h3 id="settings-editor-title" class="settings-title">Editor</h3>
    <div class="settings-row">
      <Switch
        data-testid="settings-wrap-switch"
        checked={wrapEnabled}
        label="Line wrapping"
        onchange={handleWrapChange}
      />
      <p class="settings-hint">
        When enabled, long lines wrap inside the diff viewer instead of scrolling horizontally.
      </p>
    </div>
  </section>
</div>

<style>
  .settings-panel {
    padding: var(--space-4);
  }

  .settings-section {
    margin-bottom: var(--space-6);
  }

  .settings-title {
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .settings-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .settings-hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }
</style>
