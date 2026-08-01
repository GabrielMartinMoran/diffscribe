<script lang="ts">
  import { uid } from './ids';

  let {
    label,
    content,
    placement = 'top' as 'top' | 'bottom',
    disabled = false,
    class: className = '',
  }: {
    /** Accessible name of the trigger button. */
    label: string;
    /** Tooltip text. Content is never interactive. */
    content: string;
    placement?: 'top' | 'bottom';
    disabled?: boolean;
    class?: string;
  } = $props();

  const tipId = uid('ui-tooltip');
  let open = $state(false);

  function show() {
    if (!disabled) open = true;
  }

  function hide() {
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      hide();
    }
  }
</script>

<span class="ui-tooltip ui-tooltip--{placement} {className}">
  <button
    type="button"
    class="ui-tooltip__trigger"
    aria-describedby={tipId}
    {disabled}
    onmouseenter={show}
    onmouseleave={hide}
    onfocus={show}
    onblur={hide}
    onkeydown={handleKeydown}
  >
    {label}
  </button>
  <span
    id={tipId}
    class="ui-tooltip__content"
    class:ui-tooltip__content--visible={open}
    role="tooltip"
    hidden={!open}
  >
    {content}
  </span>
</span>

<style>
  .ui-tooltip {
    position: relative;
    display: inline-flex;
  }

  .ui-tooltip__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
    cursor: pointer;
  }

  .ui-tooltip__trigger:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .ui-tooltip__trigger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ui-tooltip__content {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-tooltip);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--surface-elevated);
    border: 1px solid var(--border-default);
    box-shadow: var(--shadow-md);
    color: var(--text-primary);
    font-size: var(--text-xs);
    line-height: var(--line-height-tight);
    white-space: nowrap;
    pointer-events: none;
  }

  .ui-tooltip--top .ui-tooltip__content {
    bottom: calc(100% + var(--space-2));
  }

  .ui-tooltip--bottom .ui-tooltip__content {
    top: calc(100% + var(--space-2));
  }
</style>
