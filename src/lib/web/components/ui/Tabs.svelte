<script lang="ts">
  import type { Component } from 'svelte';

  import { tabButtonId, tabPanelId } from './ids';
  import type { TabOrientation } from './variants';
  import { isTabOrientation } from './variants';

  export type TabItem = {
    id: string;
    label: string;
    ariaLabel?: string;
    disabled?: boolean;
    icon?: Component;
    testId?: string;
  };

  let {
    tabs = [] as TabItem[],
    activeId = undefined as string | undefined,
    onchange = undefined as ((id: string) => void) | undefined,
    orientation = 'horizontal' as TabOrientation,
    ariaLabel = 'Tabs',
    class: className = '',
    ...rest
  }: {
    tabs?: TabItem[];
    activeId?: string;
    onchange?: (id: string) => void;
    orientation?: TabOrientation;
    ariaLabel?: string;
    class?: string;
    [key: string]: unknown;
  } = $props();

  const resolvedOrientation = $derived(isTabOrientation(orientation) ? orientation : 'horizontal');

  let tabRefs: (HTMLButtonElement | null)[] = [];

  function moveFocus(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    onchange?.(tab.id);
    // Resolve the button by its deterministic id at call time: the element
    // may have been re-created by a concurrent re-render, making captured
    // refs stale.
    document.getElementById(tabButtonId(tab.id))?.focus();
  }

  /** Index of the currently focused tab; falls back to the active tab. */
  function focusedTabIndex(): number {
    const focusedId = document.activeElement?.id;
    const focusedIdx = tabs.findIndex((t) => tabButtonId(t.id) === focusedId);
    if (focusedIdx >= 0) return focusedIdx;
    return Math.max(
      0,
      tabs.findIndex((t) => t.id === activeId && !t.disabled),
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    const enabled = tabs.map((t, i) => ({ tab: t, index: i })).filter(({ tab }) => !tab.disabled);
    if (enabled.length === 0) return;
    const currentIdx = Math.max(
      0,
      enabled.findIndex(({ tab }) => tab.id === tabs[focusedTabIndex()]?.id),
    );
    let nextIndex: number | undefined;

    switch (e.key) {
      case resolvedOrientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentIdx + 1) % enabled.length;
        break;
      case resolvedOrientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentIdx - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = enabled.length - 1;
        break;
      default:
        return;
    }
    moveFocus(enabled[nextIndex].index);
  }
</script>

<div
  role="tablist"
  aria-label={ariaLabel}
  aria-orientation={resolvedOrientation}
  class="ui-tabs ui-tabs--{resolvedOrientation} {className}"
  onkeydown={handleKeydown}
  {...rest}
>
  {#each tabs as tab, i (tab.id)}
    {@const Icon = tab.icon}
    <button
      type="button"
      role="tab"
      id={tabButtonId(tab.id)}
      aria-selected={activeId === tab.id}
      aria-controls={tabPanelId(tab.id)}
      aria-label={tab.ariaLabel ?? tab.label}
      tabindex={activeId === tab.id ? 0 : -1}
      disabled={tab.disabled}
      data-testid={tab.testId}
      class="ui-tabs__tab"
      class:active={activeId === tab.id}
      class:disabled={tab.disabled}
      bind:this={tabRefs[i]}
      onclick={() => !tab.disabled && onchange?.(tab.id)}
    >
      {#if Icon}
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      {/if}
      <span class="ui-tabs__label">{tab.label}</span>
    </button>
  {/each}
</div>

<style>
  .ui-tabs {
    display: flex;
    gap: 0;
  }

  .ui-tabs--horizontal {
    flex-direction: row;
  }

  .ui-tabs--vertical {
    flex-direction: column;
  }

  .ui-tabs__tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-height: 24px;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    font-family: inherit;
    cursor: pointer;
    transition:
      color var(--duration-fast) var(--ease-default),
      background var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default);
  }

  .ui-tabs__tab:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .ui-tabs__tab:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .ui-tabs__tab.active {
    color: var(--accent);
  }

  .ui-tabs__tab.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ui-tabs--horizontal .ui-tabs__tab {
    border-bottom: 2px solid transparent;
  }

  .ui-tabs--horizontal .ui-tabs__tab.active {
    border-bottom-color: var(--accent);
  }

  .ui-tabs--vertical .ui-tabs__tab {
    border-left: 2px solid transparent;
  }

  .ui-tabs--vertical .ui-tabs__tab.active {
    border-left-color: var(--accent);
    background: var(--accent-light);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-tabs__tab {
      transition: none;
    }
  }
</style>
