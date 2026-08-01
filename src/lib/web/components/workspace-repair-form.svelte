<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';

  import { enhance } from '$app/forms';

  import Button from './ui/Button.svelte';
  import TextInput from './ui/TextInput.svelte';

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
  <div class="repair-row">
    <TextInput
      id="repair-path-{workspaceId}"
      name="newPath"
      aria-label="New repository path"
      bind:value={newPath}
      placeholder="/path/to/valid/git/repo"
      disabled={loading}
    />
    <Button type="submit" size="sm" disabled={loading}>Repair</Button>
    <Button type="button" size="sm" variant="secondary" onclick={onCancelled} disabled={loading}>
      Cancel
    </Button>
  </div>
  {#if error}
    <p class="error-feedback" role="alert">{error}</p>
  {/if}
</form>

<style>
  form {
    padding: var(--space-2) 0;
  }

  .repair-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .repair-row :global(.ui-text-input) {
    flex: 1;
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
