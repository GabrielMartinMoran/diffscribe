<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';

  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  import Button from './ui/Button.svelte';
  import TextInput from './ui/TextInput.svelte';

  let {
    onRegistered = undefined as (() => void) | undefined,
  }: {
    onRegistered?: () => void;
  } = $props();

  let path = $state('');
  let displayName = $state('');
  let error = $state('');
  let loading = $state(false);

  const handleSubmit: SubmitFunction = () => {
    loading = true;
    error = '';
    return async ({ result }) => {
      loading = false;
      if (result.type === 'failure') {
        error = result.data?.error ?? 'Error registering workspace';
      } else if (result.type === 'success') {
        path = '';
        displayName = '';
        await invalidateAll();
        onRegistered?.();
      }
    };
  };
</script>

<form
  id="open-workspace-form"
  data-testid="open-workspace-form"
  method="POST"
  action="?/register"
  use:enhance={handleSubmit}
>
  <fieldset disabled={loading}>
    <legend>Open workspace</legend>

    <TextInput
      id="ws-path"
      name="repositoryPath"
      label="Repository Path"
      bind:value={path}
      placeholder="/absolute/path/to/repo"
    />

    <TextInput
      id="ws-name"
      name="displayName"
      label="Display Name"
      bind:value={displayName}
      placeholder="My Repository"
    />

    {#if error}
      <p class="error-feedback" role="alert">{error}</p>
    {/if}

    <Button type="submit" disabled={loading}>
      {loading ? 'Opening...' : 'Open'}
    </Button>
  </fieldset>
</form>

<style>
  form {
    margin: var(--space-4) 0;
    padding: var(--space-4);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-secondary);
  }

  legend {
    margin-bottom: var(--space-2);
    font-weight: var(--font-weight-semibold);
    font-size: var(--text-lg);
  }

  fieldset :global(.ui-text-input) {
    margin-top: var(--space-1);
  }

  fieldset :global(.ui-button) {
    margin-top: var(--space-4);
  }

  .error-feedback {
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--state-error-border);
    border-radius: var(--radius-sm);
    background: var(--state-error-bg);
    color: var(--severity-critical);
    font-size: var(--text-sm);
  }
</style>
