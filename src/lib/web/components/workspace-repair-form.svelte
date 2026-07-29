<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';

  import { enhance } from '$app/forms';

  let {
    workspaceId,
    onSaved,
    onCancelled,
  }: {
    workspaceId: string;
    onSaved: () => void;
    onCancelled: () => void;
  } = $props();

  let newPath = $state('');
  let error = $state('');
  let loading = $state(false);

  const handleSubmit: SubmitFunction = () => {
    loading = true;
    error = '';
    return async ({ result }) => {
      loading = false;
      if (result.type === 'failure') {
        error = result.data?.error ?? 'Repair failed';
      } else if (result.type === 'success') {
        onSaved();
      }
    };
  };
</script>

<form method="POST" action="?/repair" use:enhance={handleSubmit} data-repair-form>
  <input type="hidden" name="id" value={workspaceId} />
  <label for="repair-path-{workspaceId}" class="sr-only">New repository path</label>
  <div class="repair-row">
    <input
      id="repair-path-{workspaceId}"
      name="newPath"
      type="text"
      bind:value={newPath}
      placeholder="/path/to/valid/git/repo"
      aria-label="New repository path"
      disabled={loading}
    />
    <button type="submit" disabled={loading} class="save-btn">Repair</button>
    <button type="button" onclick={onCancelled} class="cancel-btn" disabled={loading}>
      Cancel
    </button>
  </div>
  {#if error}
    <p class="error-feedback" role="alert">{error}</p>
  {/if}
</form>

<style>
  form {
    padding: var(--space-2) 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .repair-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  input {
    flex: 1;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-family: inherit;
  }

  input:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .save-btn {
    padding: var(--space-1) var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--text-inverse);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .save-btn:hover {
    background: var(--accent-hover);
  }

  .save-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    padding: var(--space-1) var(--space-3);
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
    margin-top: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--state-error-border);
    border-radius: var(--radius-sm);
    background: var(--state-error-bg);
    color: var(--severity-critical);
    font-size: var(--text-xs);
  }
</style>
