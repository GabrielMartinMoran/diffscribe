<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';

  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

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
        error = result.data?.error ?? 'Error al registrar workspace';
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

    <label for="ws-path">Repository Path</label>
    <input
      id="ws-path"
      name="repositoryPath"
      type="text"
      bind:value={path}
      placeholder="/absolute/path/to/repo"
    />

    <label for="ws-name">Display Name</label>
    <input
      id="ws-name"
      name="displayName"
      type="text"
      bind:value={displayName}
      placeholder="My Repository"
    />

    {#if error}
      <p class="error-feedback" role="alert">{error}</p>
    {/if}

    <button type="submit" disabled={loading}>
      {loading ? 'Opening...' : 'Open'}
    </button>
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
    font-weight: var(--font-weight-semibold);
    font-size: var(--text-lg);
  }

  label {
    display: block;
    margin-top: var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  input {
    display: block;
    width: 100%;
    margin-top: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--text-base);
  }

  input:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  button {
    margin-top: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--text-inverse);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
  }

  button:hover {
    background: var(--accent-hover);
  }

  button:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
