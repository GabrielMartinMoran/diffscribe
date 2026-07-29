<script lang="ts">
  import { enhance } from '$app/forms';
  import type { WorkspaceListItem } from '$lib/server/application/dto/results/workspace-results';

  import DeleteConfirmDialog from './delete-confirm-dialog.svelte';
  import WorkspaceRenameForm from './workspace-rename-form.svelte';
  import WorkspaceRepairForm from './workspace-repair-form.svelte';

  let {
    workspace,
    isActive = false,
  }: {
    workspace: WorkspaceListItem;
    isActive: boolean;
  } = $props();

  let showRenameForm = $state(false);
  let showDeleteDialog = $state(false);
  let showRepairForm = $state(false);

  function onRenameSaved() {
    showRenameForm = false;
  }

  function onRenameCancelled() {
    showRenameForm = false;
  }

  function openDeleteDialog() {
    showDeleteDialog = true;
  }

  function closeDeleteDialog() {
    showDeleteDialog = false;
  }

  function onRepairSaved() {
    showRepairForm = false;
  }

  function onRepairCancelled() {
    showRepairForm = false;
  }

  function handleSelectKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateSelect(e, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSelect(e, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      navigateToFirstSelect();
    } else if (e.key === 'End') {
      e.preventDefault();
      navigateToLastSelect();
    }
  }

  function navigateSelect(event: KeyboardEvent, direction: number) {
    const currentBtn = (event.target as HTMLElement).closest('[data-workspace-select]');
    if (!currentBtn) return;
    const currentItem = currentBtn.closest('li');
    if (!currentItem) return;
    const sibling =
      direction > 0 ? currentItem.nextElementSibling : currentItem.previousElementSibling;
    if (!sibling) return;
    const targetBtn = sibling.querySelector('[data-workspace-select]') as HTMLElement | null;
    targetBtn?.focus();
  }

  function navigateToFirstSelect() {
    const allSelects = document.querySelectorAll('[data-workspace-select]');
    if (allSelects.length > 0) {
      (allSelects[0] as HTMLElement).focus();
    }
  }

  function navigateToLastSelect() {
    const allSelects = document.querySelectorAll('[data-workspace-select]');
    if (allSelects.length > 0) {
      (allSelects[allSelects.length - 1] as HTMLElement).focus();
    }
  }
</script>

<li
  class="nav-item"
  class:active={isActive}
  class:invalid={workspace.status === 'invalid'}
  role="listitem"
>
  <form method="POST" action="?/select" class="select-form" use:enhance>
    <input type="hidden" name="id" value={workspace.id} />
    <button
      type="submit"
      class="select-btn"
      data-workspace-select
      aria-label="Select workspace {workspace.displayName}"
      aria-current={isActive ? 'true' : undefined}
      onkeydown={handleSelectKeydown}
    >
      <span class="status-dot status-{workspace.status}" aria-hidden="true"></span>
      <span class="name">{workspace.displayName}</span>
      <span class="path" title={workspace.repositoryPath}>{workspace.repositoryPath}</span>
    </button>
  </form>

  {#if isActive}
    <span class="active-badge" role="status">active</span>
  {/if}

  {#if workspace.status === 'invalid'}
    <span class="invalid-badge" aria-label="Invalid workspace">invalid</span>
  {/if}

  <div class="actions">
    {#if workspace.status === 'invalid'}
      <button
        class="action-btn repair-btn"
        onclick={() => (showRepairForm = !showRepairForm)}
        aria-label="Repair {workspace.displayName}"
        aria-expanded={showRepairForm}
      >
        Repair
      </button>
    {/if}
    <button
      class="action-btn"
      onclick={() => (showRenameForm = !showRenameForm)}
      aria-label="Rename {workspace.displayName}"
      aria-expanded={showRenameForm}
    >
      Rename
    </button>
    <button
      class="action-btn danger"
      onclick={openDeleteDialog}
      aria-label="Delete {workspace.displayName}"
    >
      Delete
    </button>
  </div>

  {#if showRenameForm}
    <div class="rename-form-container" data-rename-form>
      <WorkspaceRenameForm
        workspaceId={workspace.id}
        currentName={workspace.displayName}
        onSaved={onRenameSaved}
        onCancelled={onRenameCancelled}
      />
    </div>
  {/if}

  {#if showRepairForm}
    <div class="repair-form-container" data-repair-form>
      <WorkspaceRepairForm
        workspaceId={workspace.id}
        onSaved={onRepairSaved}
        onCancelled={onRepairCancelled}
      />
    </div>
  {/if}
</li>

{#if showDeleteDialog}
  <DeleteConfirmDialog
    workspaceId={workspace.id}
    workspaceName={workspace.displayName}
    onClose={closeDeleteDialog}
  />
{/if}

<style>
  .nav-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-primary);
    transition: background var(--duration-fast) var(--ease-default);
  }

  .nav-item:hover {
    background: var(--state-hover);
  }

  .nav-item.active {
    background: var(--accent-muted);
    border-left: 3px solid var(--accent);
  }

  .nav-item.invalid {
    opacity: 0.7;
  }

  .select-form {
    flex: 1;
    min-width: 0;
  }

  .select-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  .select-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .status-valid {
    background: var(--diff-added-text);
  }

  .status-invalid {
    background: var(--severity-critical);
  }

  .name {
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .path {
    font-family: var(--font-family-mono);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .active-badge {
    font-size: var(--text-xs);
    font-weight: var(--font-weight-semibold);
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--diff-added-bg);
    color: var(--diff-added-text);
    border: 1px solid var(--diff-added-border);
    text-transform: uppercase;
  }

  .invalid-badge {
    font-size: var(--text-xs);
    font-weight: var(--font-weight-semibold);
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--state-error-bg);
    color: var(--severity-critical);
    border: 1px solid var(--state-error-border);
    text-transform: uppercase;
  }

  .actions {
    display: flex;
    gap: var(--space-1);
  }

  .action-btn {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .action-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .action-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .action-btn.danger:hover {
    background: var(--severity-critical);
    border-color: var(--severity-critical);
  }

  .rename-form-container {
    width: 100%;
    flex-basis: 100%;
  }

  .repair-form-container {
    width: 100%;
    flex-basis: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-item {
      transition: none;
    }
  }
</style>
