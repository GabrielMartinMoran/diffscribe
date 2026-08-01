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

<span class="ui-status-badge ui-status-badge--{resolvedTone} {className}" {...rest}>
  <span class="ui-status-badge__dot" aria-hidden="true"></span>
  {@render children?.()}
</span>

<style>
  .ui-status-badge {
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

  .ui-status-badge__dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: currentColor;
  }

  .ui-status-badge--neutral {
    background: var(--surface-tertiary);
    color: var(--text-secondary);
  }

  .ui-status-badge--info {
    background: var(--accent-muted);
    color: var(--color-info);
  }

  .ui-status-badge--success {
    background: var(--state-success-bg);
    color: var(--color-success);
  }

  .ui-status-badge--warning {
    background: var(--surface-warning);
    color: var(--color-warning);
  }

  .ui-status-badge--error {
    background: var(--state-error-bg);
    color: var(--color-error);
  }
</style>
