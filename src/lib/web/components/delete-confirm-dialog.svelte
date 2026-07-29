<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';
  import { onMount } from 'svelte';

  import { enhance } from '$app/forms';

  let {
    workspaceId,
    workspaceName,
    onClose,
  }: {
    workspaceId: string;
    workspaceName: string;
    onClose: () => void;
  } = $props();

  let loading = $state(false);
  let error = $state('');
  let dialogRef = $state<HTMLDialogElement>();

  const handleSubmit: SubmitFunction = () => {
    loading = true;
    error = '';
    return async ({ result }) => {
      loading = false;
      if (result.type === 'failure') {
        error = result.data?.error ?? 'Delete failed';
      } else if (result.type === 'success') {
        onClose();
      }
    };
  };

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  onMount(() => {
    dialogRef?.showModal();
  });
</script>

<dialog
  bind:this={dialogRef}
  class="confirm-dialog"
  role="alertdialog"
  aria-labelledby="delete-title"
  aria-describedby="delete-desc"
  onkeydown={onKeyDown}
  onclose={onClose}
>
  <h3 id="delete-title">Delete workspace</h3>
  <p id="delete-desc">
    Are you sure you want to delete <strong>{workspaceName}</strong>? This will remove the workspace
    from DiffScribe but will not touch the repository directory.
  </p>

  <form method="POST" action="?/delete" use:enhance={handleSubmit}>
    <input type="hidden" name="id" value={workspaceId} />

    {#if error}
      <p class="error-feedback" role="alert">{error}</p>
    {/if}

    <div class="dialog-actions">
      <button type="submit" class="confirm-btn" disabled={loading}>
        {loading ? 'Deleting...' : 'Delete'}
      </button>
      <button type="button" class="cancel-btn" onclick={onClose} disabled={loading}>
        Cancel
      </button>
    </div>
  </form>
</dialog>

<style>
  .confirm-dialog {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    background: var(--surface-primary);
    box-shadow: var(--shadow-lg);
    max-width: 400px;
    width: 90vw;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    z-index: var(--z-modal);
  }

  .confirm-dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }

  h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-weight-semibold);
    margin: 0 0 var(--space-4);
    color: var(--severity-critical);
  }

  p {
    font-size: var(--text-sm);
    line-height: var(--line-height-normal);
    color: var(--text-secondary);
    margin: 0 0 var(--space-4);
  }

  .dialog-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    margin-top: var(--space-4);
  }

  .confirm-btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--severity-critical);
    color: var(--text-inverse);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
  }

  .confirm-btn:hover {
    background: #b91c1c;
  }

  .confirm-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .confirm-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: var(--surface-tertiary);
  }

  .cancel-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .error-feedback {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--state-error-border);
    border-radius: var(--radius-sm);
    background: var(--state-error-bg);
    color: var(--severity-critical);
    font-size: var(--text-sm);
    margin-bottom: var(--space-3);
  }

  @media (prefers-reduced-motion: reduce) {
    .confirm-dialog {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
