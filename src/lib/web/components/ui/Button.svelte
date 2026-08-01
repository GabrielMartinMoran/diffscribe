<script lang="ts">
  import type { ButtonSize, ButtonVariant } from './variants';
  import { isButtonVariant, isControlSize } from './variants';

  let {
    variant = 'primary' as ButtonVariant,
    size = 'md' as ButtonSize,
    type = 'button' as 'button' | 'submit' | 'reset',
    loading = false,
    disabled = false,
    class: className = '',
    children,
    ...rest
  }: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: 'button' | 'submit' | 'reset';
    loading?: boolean;
    disabled?: boolean;
    class?: string;
    children?: import('svelte').Snippet;
    [key: string]: unknown;
  } = $props();

  const resolvedVariant = $derived(isButtonVariant(variant) ? variant : 'primary');
  const resolvedSize = $derived(isControlSize(size) ? size : 'md');
  const isDisabled = $derived(disabled || loading);
</script>

<button
  {type}
  class="ui-button ui-button--{resolvedVariant} ui-button--{resolvedSize} {className}"
  disabled={isDisabled}
  aria-busy={loading || undefined}
  {...rest}
>
  {#if loading}
    <span class="ui-button__spinner" aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</button>

<style>
  .ui-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    line-height: 1;
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default);
  }

  .ui-button:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .ui-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Sizes (provisional scale, see docs/design.md) ── */

  .ui-button--sm {
    min-height: 24px;
    padding: 0 var(--space-2);
  }

  .ui-button--md {
    min-height: 32px;
    padding: 0 var(--space-3);
  }

  .ui-button--lg {
    min-height: 40px;
    padding: 0 var(--space-4);
    font-size: var(--text-base);
  }

  /* ── Variants ── */

  .ui-button--primary {
    border: none;
    background: var(--accent);
    color: var(--text-inverse);
  }

  .ui-button--primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .ui-button--secondary {
    border: 1px solid var(--border-default);
    background: var(--surface-secondary);
    color: var(--text-primary);
  }

  .ui-button--secondary:hover:not(:disabled) {
    background: var(--surface-tertiary);
  }

  .ui-button--ghost {
    border: none;
    background: transparent;
    color: var(--text-primary);
  }

  .ui-button--ghost:hover:not(:disabled) {
    background: var(--state-hover);
  }

  .ui-button--danger {
    border: none;
    background: var(--severity-critical);
    color: var(--text-inverse);
  }

  .ui-button--danger:hover:not(:disabled) {
    background: var(--color-error);
  }

  /* ── Loading ── */

  .ui-button__spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: var(--radius-full);
    animation: ui-button-spin var(--duration-normal) linear infinite;
  }

  @keyframes ui-button-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-button,
    .ui-button__spinner {
      transition: none;
      animation: none;
    }
  }
</style>
