<script lang="ts">
  import { Ellipsis, TriangleAlert } from 'svelte-lucide';

  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import type { WorkspaceListItem } from '$lib/server/application/dto/results/workspace-results';
  import { fileListStatusLoader } from '$lib/web/services/file-list-status-loader';
  import { projectTreeLoader } from '$lib/web/services/project-tree-loader';

  import DeleteConfirmDialog from './delete-confirm-dialog.svelte';
  import Dialog from './ui/Dialog.svelte';
  import Menu from './ui/Menu.svelte';
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
  let showWarningDialog = $state(false);

  function onRenameSaved() {
    showRenameForm = false;
    // Rename changes the workspace list: refresh only the declared
    // app:workspaces resource (targeted, no full page reload).
    void invalidate('app:workspaces');
  }

  function onRenameCancelled() {
    showRenameForm = false;
  }

  function closeDeleteDialog() {
    showDeleteDialog = false;
  }

  function onRepairSaved() {
    showRepairForm = false;
    // The repaired workspace may point at different repository content:
    // drop its cached Project tree and file-list statuses — targeted, only
    // the affected workspace — and refresh the declared workspace-list
    // resource so the sidebar reflects the repaired status.
    projectTreeLoader.invalidate(workspace.id);
    fileListStatusLoader.invalidateWorkspace(workspace.id);
    void invalidate('app:workspaces');
  }

  function onRepairCancelled() {
    showRepairForm = false;
  }

  function closeWarningDialog() {
    showWarningDialog = false;
  }

  // Repair from the warning dialog: close the dialog and reuse the existing
  // repair form rendered by this item.
  function repairFromWarningDialog() {
    showWarningDialog = false;
    showRepairForm = true;
  }

  function handleMenuSelect(value: string) {
    if (value === 'rename') {
      showRenameForm = true;
    } else if (value === 'repair') {
      showRepairForm = true;
    } else if (value === 'delete') {
      showDeleteDialog = true;
    }
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

  {#if workspace.status === 'invalid'}
    <button
      type="button"
      data-testid="invalid-warning-btn"
      class="invalid-warning-btn"
      aria-label="Invalid workspace, repair required"
      title="Invalid workspace, repair required"
      onclick={() => (showWarningDialog = true)}
    >
      <TriangleAlert size="14" strokeWidth="1.5" aria-hidden="true" />
    </button>
  {/if}

  <Menu
    data-testid="workspace-actions"
    label="Workspace actions"
    icon={Ellipsis}
    align="end"
    items={[
      ...(workspace.status === 'invalid' ? [{ value: 'repair', label: 'Repair' }] : []),
      { value: 'rename', label: 'Rename' },
      { value: 'delete', label: 'Delete', destructive: true },
    ]}
    onselect={handleMenuSelect}
  />

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

{#if showWarningDialog}
  <Dialog
    open={true}
    id="invalid-workspace-{workspace.id}"
    title="Invalid workspace"
    onclose={closeWarningDialog}
  >
    <p id="invalid-workspace-desc">
      This workspace points to a repository path that is missing or no longer a valid Git
      repository. Repair it to continue reviewing.
    </p>

    {#snippet actions()}
      <button type="button" class="btn-secondary" onclick={closeWarningDialog}>Close</button>
      <button type="button" class="btn-primary" onclick={repairFromWarningDialog}>Repair</button>
    {/snippet}
  </Dialog>
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

  .invalid-warning-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--state-error-border);
    border-radius: var(--radius-sm);
    background: var(--state-error-bg);
    color: var(--severity-critical);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .invalid-warning-btn:hover {
    background: var(--state-error-border);
    color: var(--text-inverse);
  }

  .invalid-warning-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .btn-primary {
    padding: var(--space-1) var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--text-inverse);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--text-sm);
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
