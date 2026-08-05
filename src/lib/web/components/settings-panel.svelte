<script lang="ts">
  import { browser } from '$app/environment';
  import {
    type FileListView,
    type MarkdownView,
    readVisualSettings,
    writeVisualSettings,
  } from '$lib/web/stores/visual-settings-store';
  import { readStoredWrap, resolveWrap, writeStoredWrap } from '$lib/web/stores/wrap-store';

  import ThemeSwitcher from './theme-switcher.svelte';
  import Switch from './ui/Switch.svelte';

  let wrapEnabled = $state(false);
  let fileListView = $state<FileListView>('tree');
  let markdownView = $state<MarkdownView>('preview');

  $effect(() => {
    if (!browser) return;
    wrapEnabled = resolveWrap(readStoredWrap(window.localStorage));
    const settings = readVisualSettings(window.localStorage);
    fileListView = settings.fileListView;
    markdownView = settings.markdownView;
  });

  function handleWrapChange() {
    wrapEnabled = !wrapEnabled;
    if (browser) {
      writeStoredWrap(wrapEnabled, window.localStorage);
    }
  }

  function handleFileListViewChange(next: FileListView) {
    fileListView = next;
    if (browser) {
      const settings = readVisualSettings(window.localStorage);
      writeVisualSettings({ ...settings, fileListView: next }, window.localStorage);
    }
  }

  function handleMarkdownViewChange(next: MarkdownView) {
    markdownView = next;
    if (browser) {
      const settings = readVisualSettings(window.localStorage);
      writeVisualSettings({ ...settings, markdownView: next }, window.localStorage);
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
    data-testid="settings-section-files"
    class="settings-section"
    aria-labelledby="settings-files-title"
  >
    <h3 id="settings-files-title" class="settings-title">Files</h3>
    <div class="settings-row">
      <span class="settings-label" id="settings-file-list-label">File list view</span>
      <div
        class="segmented-control"
        role="group"
        aria-labelledby="settings-file-list-label"
        data-testid="settings-file-list-view"
      >
        <button
          type="button"
          class="segment"
          class:active={fileListView === 'tree'}
          data-testid="settings-file-list-tree"
          aria-pressed={fileListView === 'tree'}
          onclick={() => handleFileListViewChange('tree')}
        >
          Tree
        </button>
        <button
          type="button"
          class="segment"
          class:active={fileListView === 'list'}
          data-testid="settings-file-list-list"
          aria-pressed={fileListView === 'list'}
          onclick={() => handleFileListViewChange('list')}
        >
          List
        </button>
      </div>
    </div>
    <div class="settings-row">
      <span class="settings-label" id="settings-markdown-label">Markdown default view</span>
      <div
        class="segmented-control"
        role="group"
        aria-labelledby="settings-markdown-label"
        data-testid="settings-markdown-view"
      >
        <button
          type="button"
          class="segment"
          class:active={markdownView === 'preview'}
          data-testid="settings-markdown-preview"
          aria-pressed={markdownView === 'preview'}
          onclick={() => handleMarkdownViewChange('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          class="segment"
          class:active={markdownView === 'raw'}
          data-testid="settings-markdown-raw"
          aria-pressed={markdownView === 'raw'}
          onclick={() => handleMarkdownViewChange('raw')}
        >
          Raw
        </button>
      </div>
      <p class="settings-hint">
        Choose how Markdown files open in the source viewer and how the Git file list is presented.
      </p>
    </div>
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
    margin-bottom: var(--space-4);
  }

  .settings-hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .settings-label {
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .segmented-control {
    display: inline-flex;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .segment {
    padding: var(--space-1) var(--space-3);
    border: none;
    border-left: 1px solid var(--border-default);
    background: var(--surface-secondary);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .segment:first-child {
    border-left: none;
  }

  .segment.active {
    background: var(--accent);
    color: var(--text-inverse);
  }

  .segment:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
    position: relative;
    z-index: 1;
  }
</style>
