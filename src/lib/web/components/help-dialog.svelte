<script lang="ts">
  import Dialog from './ui/Dialog.svelte';

  let {
    open = false,
    onClose = undefined as (() => void) | undefined,
  }: {
    open?: boolean;
    onClose?: () => void;
  } = $props();

  interface ShortcutRow {
    keys: string;
    description: string;
  }

  const SHORTCUTS: ShortcutRow[] = [
    { keys: 'Ctrl/Cmd + P', description: 'Quick Open' },
    { keys: 'Ctrl + Shift + D', description: 'Refresh diff' },
    { keys: 'Ctrl/Cmd + click', description: 'Open file in a new tab' },
    { keys: 'Middle click', description: 'Close a file tab' },
    { keys: 'Shift + Arrow', description: 'Select diff lines' },
    { keys: 'j / k', description: 'Navigate hunks' },
    { keys: 'Arrow keys', description: 'Move through lists' },
    { keys: 'Escape', description: 'Close dialogs and drawers' },
    { keys: '?', description: 'Open this help (when not typing)' },
  ];
</script>

<Dialog {open} id="help-dialog" title="Keyboard shortcuts" onclose={onClose}>
  <div class="help-dialog" data-testid="help-dialog">
    <p class="help-intro">Mouse and keyboard shortcuts for the review workbench.</p>
    <dl class="shortcut-list">
      {#each SHORTCUTS as row (row.keys)}
        <div class="shortcut-row">
          <dt class="shortcut-keys"><kbd>{row.keys}</kbd></dt>
          <dd class="shortcut-desc">{row.description}</dd>
        </div>
      {/each}
    </dl>
  </div>
</Dialog>

<style>
  .help-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .help-intro {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
  }

  .shortcut-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .shortcut-keys {
    flex-shrink: 0;
    font-size: var(--text-xs);
  }

  .shortcut-keys kbd {
    padding: 2px var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .shortcut-desc {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-align: right;
  }
</style>
