<script lang="ts">
  import { FileText, X } from 'svelte-lucide';

  import { activeFile } from '$lib/web/stores/active-file-store';

  let {
    onCloseFile = undefined as ((path: string) => void) | undefined,
  }: {
    onCloseFile?: (path: string) => void;
  } = $props();
</script>

<div data-testid="open-files-tabs" class="open-files-tabs" role="tablist" aria-label="Open files">
  {#if $activeFile}
    <div class="file-tab" role="tab" aria-selected={true} data-testid="open-file-tab">
      <FileText size="14" strokeWidth="1.5" ariaLabel="File" />
      <span class="file-label">{$activeFile.label}</span>
      <button
        class="close-btn"
        aria-label="Close {$activeFile.label}"
        data-testid="close-file-tab"
        onclick={() => onCloseFile?.($activeFile!.path)}
      >
        <X size="12" strokeWidth="2" ariaLabel="Close" />
      </button>
    </div>
  {:else}
    <div class="file-tab-empty" role="tabpanel" aria-label="No file selected">
      <span class="empty-text">No file selected</span>
    </div>
  {/if}
</div>

<style>
  .open-files-tabs {
    display: flex;
    align-items: center;
    gap: 0;
    height: 32px;
    padding: 0 var(--space-1);
    background: var(--surface-secondary);
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .file-tab {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-bottom: none;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: var(--text-xs);
    white-space: nowrap;
    max-width: 200px;
  }

  .file-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1px;
    border: none;
    border-radius: 2px;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    opacity: 0.6;
    transition:
      opacity 0.1s,
      background 0.1s;
  }

  .close-btn:hover {
    opacity: 1;
    background: var(--surface-hover);
  }

  .close-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .file-tab-empty {
    display: flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }

  .empty-text {
    font-style: italic;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }
  }
</style>
