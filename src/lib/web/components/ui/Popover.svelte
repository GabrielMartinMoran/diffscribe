<script lang="ts">
  import { uid } from './ids';

  let {
    label,
    content,
    align = 'start' as 'start' | 'end',
    class: className = '',
  }: {
    /** Accessible name of the trigger button. */
    label: string;
    /** Non-modal content surface. */
    content: import('svelte').Snippet;
    align?: 'start' | 'end';
    class?: string;
  } = $props();

  const contentId = uid('ui-popover');
  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement>();
  let wrapperRef = $state<HTMLDivElement>();
  let contentRef = $state<HTMLDivElement>();

  function toggle() {
    if (open) {
      close();
    } else {
      open = true;
      // Predictable focus: move into the content surface once visible.
      requestAnimationFrame(() => {
        const first = contentRef?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (first) {
          first.focus();
        } else {
          contentRef?.focus();
        }
      });
    }
  }

  function close() {
    if (!open) return;
    open = false;
    triggerRef?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  }

  // Escape closes the popover regardless of where focus is inside it.
  $effect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });

  // Light dismiss: click outside the wrapper closes the popover.
  $effect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef && e.target instanceof Node && !wrapperRef.contains(e.target)) {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  });
</script>

<div bind:this={wrapperRef} class="ui-popover ui-popover--align-{align} {className}">
  <button
    bind:this={triggerRef}
    type="button"
    class="ui-popover__trigger"
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-controls={contentId}
    onclick={toggle}
  >
    {label}
  </button>
  <div
    bind:this={contentRef}
    id={contentId}
    class="ui-popover__content"
    class:ui-popover__content--open={open}
    hidden={!open}
    tabindex="-1"
  >
    {@render content()}
  </div>
</div>

<style>
  .ui-popover {
    position: relative;
    display: inline-block;
  }

  .ui-popover__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
    cursor: pointer;
  }

  .ui-popover__trigger:hover {
    background: var(--surface-tertiary);
  }

  .ui-popover__trigger:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .ui-popover__content {
    position: absolute;
    top: calc(100% + var(--space-2));
    z-index: var(--z-dropdown);
    min-width: 160px;
    padding: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-elevated);
    box-shadow: var(--shadow-md);
    color: var(--text-primary);
    font-size: var(--text-sm);
  }

  .ui-popover__content:focus-visible {
    outline: none;
  }

  .ui-popover--align-start .ui-popover__content {
    left: 0;
  }

  .ui-popover--align-end .ui-popover__content {
    right: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-popover__trigger {
      transition: none;
    }
  }
</style>
