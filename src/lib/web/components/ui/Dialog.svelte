<script lang="ts">
  import { dialogTitleId } from './ids';

  let {
    open = false,
    id = 'ui-dialog',
    title = '',
    onclose = undefined as (() => void) | undefined,
    class: className = '',
    children,
    actions,
    ...rest
  }: {
    open?: boolean;
    id?: string;
    title?: string;
    onclose?: () => void;
    class?: string;
    children?: import('svelte').Snippet;
    actions?: import('svelte').Snippet;
    [key: string]: unknown;
  } = $props();

  let dialogRef = $state<HTMLDialogElement>();

  const titleId = $derived(dialogTitleId(id));

  // Native modal: showModal() when open, close() when dismissed. The browser
  // handles Escape and restores focus to the invoker on close.
  $effect(() => {
    const dialog = dialogRef;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function handleClose() {
    onclose?.();
  }
</script>

<dialog
  bind:this={dialogRef}
  class="ui-dialog {className}"
  aria-labelledby={titleId}
  onclose={handleClose}
  {...rest}
>
  {#if title}
    <h2 id={titleId} class="ui-dialog__title">{title}</h2>
  {/if}
  <div class="ui-dialog__body">
    {@render children?.()}
  </div>
  {#if actions}
    <div class="ui-dialog__actions">
      {@render actions()}
    </div>
  {/if}
</dialog>

<style>
  .ui-dialog {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    background: var(--surface-primary);
    color: var(--text-primary);
    box-shadow: var(--shadow-lg);
    max-width: 420px;
    width: 90vw;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    z-index: var(--z-modal);
  }

  .ui-dialog::backdrop {
    background: var(--surface-overlay);
  }

  .ui-dialog__title {
    margin: 0 0 var(--space-4);
    font-size: var(--text-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .ui-dialog__body {
    font-size: var(--text-sm);
    line-height: var(--line-height-normal);
    color: var(--text-secondary);
  }

  .ui-dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-dialog {
      transition: none;
      animation: none;
    }
  }
</style>
