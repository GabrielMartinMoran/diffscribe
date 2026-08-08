<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';

  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  // Broad invalidation is kept here on purpose: the workspace-git-review-ux
  // feature contract pins invalidateAll after registration, and the page
  // load declares depends('app:workspaces') so the refresh stays scoped in
  // effect to the declared resource contract.
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

  // Browsers expose directory selection through the non-standard
  // `webkitdirectory` input attribute. When unsupported, the Browse control
  // is hidden and manual path entry stays the only option.
  let supportsDirectoryBrowse = $state(false);
  let browseHintVisible = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!browser) return;
    supportsDirectoryBrowse = 'webkitdirectory' in HTMLInputElement.prototype;
  });

  function handleDirectoryPicked() {
    const files = fileInput?.files;
    const first = files?.[0];
    const relativePath = first?.webkitRelativePath;
    if (!relativePath) return;
    // Pre-fill with the picked directory name; browsers cannot return the
    // absolute path, so the user completes it manually.
    path = relativePath.split('/')[0];
    browseHintVisible = true;
    if (fileInput) fileInput.value = '';
    document.getElementById('ws-path')?.focus();
  }

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
        browseHintVisible = false;
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

    <div class="path-row">
      <TextInput
        id="ws-path"
        name="repositoryPath"
        label="Repository Path"
        bind:value={path}
        placeholder="/absolute/path/to/repo"
      />

      {#if supportsDirectoryBrowse}
        <button
          type="button"
          class="browse-btn"
          data-testid="ws-path-browse"
          aria-label="Browse for repository directory"
          onclick={() => fileInput?.click()}
        >
          Browse…
        </button>
      {/if}

      {#if browseHintVisible}
        <p class="browse-hint" data-testid="ws-path-browse-hint">
          Browsers cannot return the absolute path — complete it after browsing.
        </p>
      {/if}

      {#if supportsDirectoryBrowse}
        <input
          bind:this={fileInput}
          type="file"
          webkitdirectory
          hidden
          aria-hidden="true"
          tabindex="-1"
          onchange={handleDirectoryPicked}
        />
      {/if}
    </div>

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
    flex: 1;
  }

  .path-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .browse-btn {
    align-self: flex-start;
    margin-top: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .browse-btn:hover {
    background: var(--surface-hover);
    border-color: var(--accent);
  }

  .browse-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .browse-hint {
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--text-xs);
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
