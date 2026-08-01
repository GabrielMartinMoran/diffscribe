<script lang="ts">
  import { Files, Folder, GitBranch, PanelLeftOpen, Settings } from 'svelte-lucide';

  import type { TabItem } from './ui/Tabs.svelte';
  import Tabs from './ui/Tabs.svelte';

  export type RailTabKey = 'workspaces' | 'project' | 'git' | 'settings';

  let {
    activeTab = 'workspaces' as RailTabKey,
    onTabChange = undefined as ((tab: RailTabKey) => void) | undefined,
    leftCollapsed = false,
    onToggleLeft = undefined as (() => void) | undefined,
    isMobile = false,
  }: {
    activeTab?: RailTabKey;
    onTabChange?: (tab: RailTabKey) => void;
    leftCollapsed?: boolean;
    onToggleLeft?: () => void;
    isMobile?: boolean;
  } = $props();

  const tabs: TabItem[] = [
    {
      id: 'workspaces',
      label: 'Workspaces',
      ariaLabel: 'Workspaces',
      icon: Files,
      testId: 'rail-tab-workspaces',
    },
    {
      id: 'project',
      label: 'Project',
      ariaLabel: 'Project',
      icon: Folder,
      testId: 'rail-tab-project',
    },
    { id: 'git', label: 'Git', ariaLabel: 'Git', icon: GitBranch, testId: 'rail-tab-git' },
    {
      id: 'settings',
      label: 'Settings',
      ariaLabel: 'Settings',
      icon: Settings,
      testId: 'rail-tab-settings',
    },
  ];
</script>

<div data-testid="rail-tabs" class="rail-tabs" class:is-mobile={isMobile} tabindex="-1">
  <Tabs
    {tabs}
    activeId={activeTab}
    orientation="vertical"
    ariaLabel="Navigation tabs"
    onchange={(id) => onTabChange?.(id as RailTabKey)}
  />

  {#if leftCollapsed}
    <button
      data-testid="left-panel-reopen-btn"
      class="rail-reopen-btn"
      aria-label="Open left panel"
      onclick={onToggleLeft}
    >
      <PanelLeftOpen size="18" strokeWidth="1.5" ariaLabel="Open left panel" />
    </button>
  {/if}
</div>

<style>
  .rail-tabs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: 48px;
    min-width: 48px;
    padding: var(--space-2) 0;
    background: var(--surface-primary);
    border-right: 1px solid var(--border-subtle);
    overflow-y: auto;
    /* Grid item: stay inside the viewport row. */
    min-height: 0;
  }

  .rail-tabs :global(.ui-tabs) {
    gap: var(--space-1);
  }

  .rail-tabs :global(.ui-tabs__tab) {
    width: 40px;
    height: 48px;
    padding: var(--space-1) 0;
    border-left: 2px solid transparent;
    flex-direction: column;
    gap: 2px;
  }

  .rail-tabs :global(.ui-tabs__tab.active) {
    color: var(--accent);
    background: var(--accent-light);
    border-left-color: var(--accent);
  }

  .rail-tabs :global(.ui-tabs__tab:hover:not(:disabled)) {
    background: var(--surface-hover);
  }

  .rail-tabs :global(.ui-tabs__label) {
    font-size: 8px;
    line-height: 1;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .rail-reopen-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-top: auto;
    padding: var(--space-1);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--accent);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .rail-reopen-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
  }

  .rail-reopen-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  /* ── Mobile rail: no label text, tighter spacing ── */

  .rail-tabs.is-mobile :global(.ui-tabs__label) {
    display: none;
  }

  .rail-tabs.is-mobile :global(.ui-tabs__tab) {
    height: 40px;
    width: 40px;
  }

  @media (max-width: 768px) {
    .rail-tabs :global(.ui-tabs__label) {
      display: none;
    }

    .rail-tabs :global(.ui-tabs__tab) {
      height: 40px;
      width: 40px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rail-tabs :global(.ui-tabs__tab),
    .rail-reopen-btn {
      transition: none;
    }
  }
</style>
