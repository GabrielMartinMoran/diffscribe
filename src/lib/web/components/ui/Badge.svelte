<script lang="ts">
  import type { BadgeTone } from './variants';
  import { isBadgeTone } from './variants';

  let {
    tone = 'neutral' as BadgeTone,
    class: className = '',
    children,
    ...rest
  }: {
    tone?: BadgeTone;
    class?: string;
    children?: import('svelte').Snippet;
    [key: string]: unknown;
  } = $props();

  const resolvedTone = $derived(isBadgeTone(tone) ? tone : 'neutral');
</script>

<span class="ui-badge ui-badge--{resolvedTone} {className}" {...rest}>
  {@render children?.()}
</span>

<style>
  .ui-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 1px var(--space-2);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-tight);
    white-space: nowrap;
  }

  .ui-badge--neutral {
    background: var(--surface-tertiary);
    color: var(--text-secondary);
  }

  .ui-badge--info {
    background: var(--accent-muted);
    color: var(--color-info);
  }

  .ui-badge--success {
    background: var(--state-success-bg);
    color: var(--color-success);
  }

  .ui-badge--warning {
    background: var(--surface-warning);
    color: var(--color-warning);
  }

  .ui-badge--error {
    background: var(--state-error-bg);
    color: var(--color-error);
  }
</style>
