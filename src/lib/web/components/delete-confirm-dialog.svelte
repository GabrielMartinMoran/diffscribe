<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';

  import { enhance } from '$app/forms';

  import Button from './ui/Button.svelte';
  import Dialog from './ui/Dialog.svelte';

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
</script>

<Dialog
  open={true}
  id="delete-confirm"
  title="Delete workspace"
  role="alertdialog"
  aria-describedby="delete-desc"
  onclose={onClose}
>
  <p id="delete-desc">
    Are you sure you want to delete <strong>{workspaceName}</strong>? This will remove the workspace
    from DiffScribe but will not touch the repository directory.
  </p>

  {#snippet actions()}
    <form method="POST" action="?/delete" use:enhance={handleSubmit}>
      <input type="hidden" name="id" value={workspaceId} />

      {#if error}
        <p class="error-feedback" role="alert">{error}</p>
      {/if}

      <div class="dialog-actions">
        <Button type="submit" variant="danger" disabled={loading}>
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
        <Button type="button" variant="secondary" onclick={onClose} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  {/snippet}
</Dialog>

<style>
  .error-feedback {
    margin-bottom: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--state-error-border);
    border-radius: var(--radius-sm);
    background: var(--state-error-bg);
    color: var(--severity-critical);
    font-size: var(--text-sm);
  }

  .dialog-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
  }
</style>
