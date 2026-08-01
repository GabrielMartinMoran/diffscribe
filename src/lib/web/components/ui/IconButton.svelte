<script lang="ts">
  import type { ControlSize } from './variants';
  import { isControlSize } from './variants';

  let {
    label,
    size = 'md' as ControlSize,
    type = 'button' as 'button' | 'submit' | 'reset',
    disabled = false,
    class: className = '',
    children,
    ...rest
  }: {
    /** Required accessible name for the icon-only button. */
    label: string;
    size?: ControlSize;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    class?: string;
    children?: import('svelte').Snippet;
    [key: string]: unknown;
  } = $props();

  const resolvedSize = $derived(isControlSize(size) ? size : 'md');
</script>

<button
  {type}
  class="ui-icon-button ui-icon-button--{resolvedSize} {className}"
  aria-label={label}
  {disabled}
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .ui-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition:
      color var(--duration-fast) var(--ease-default),
      background var(--duration-fast) var(--ease-default);
  }

  .ui-icon-button:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--state-hover);
  }

  .ui-icon-button:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .ui-icon-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Sizes (provisional scale, see docs/design.md) ── */

  .ui-icon-button--sm {
    min-width: 24px;
    min-height: 24px;
  }

  .ui-icon-button--md {
    min-width: 32px;
    min-height: 32px;
  }

  .ui-icon-button--lg {
    min-width: 40px;
    min-height: 40px;
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-icon-button {
      transition: none;
    }
  }
</style>
