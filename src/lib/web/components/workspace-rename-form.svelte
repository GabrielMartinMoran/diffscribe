<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';

  import { enhance } from '$app/forms';

  import Button from './ui/Button.svelte';
  import TextInput from './ui/TextInput.svelte';

  let {
    workspaceId,
    currentName,
    onSaved,
    onCancelled,
  }: {
    workspaceId: string;
    currentName: string;
    onSaved: () => void;
    onCancelled: () => void;
  } = $props();

  // eslint-disable-next-line svelte/prefer-writable-derived
  let displayName = $state('');
  let error = $state('');
  let loading = $state(false);

  $effect(() => {
    displayName = currentName;
  });

  const handleSubmit: SubmitFunction = () => {
    loading = true;
    error = '';
    return async ({ result }) => {
      loading = false;
      if (result.type === 'failure') {
        error = result.data?.error ?? 'Rename failed';
      } else if (result.type === 'success') {
        onSaved();
      }
    };
  };
</script>

<form method="POST" action="?/rename" use:enhance={handleSubmit}>
  <input type="hidden" name="id" value={workspaceId} />
  <div class="rename-row">
    <TextInput
      id="rename-{workspaceId}"
      name="displayName"
      aria-label="New name for {currentName}"
      bind:value={displayName}
      maxlength="200"
      placeholder={currentName}
      disabled={loading}
    />
    <Button type="submit" size="sm" disabled={loading}>Save</Button>
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

  .rename-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .rename-row :global(.ui-text-input) {
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
