<script lang="ts">
  import { CircleQuestionMark, Files, Folder, GitBranch, Settings } from 'svelte-lucide';

  import type { TabItem } from './ui/Tabs.svelte';
  import Tabs from './ui/Tabs.svelte';

  export type RailTabKey = 'workspaces' | 'project' | 'git' | 'settings';

  let {
    activeTab = 'workspaces' as RailTabKey,
    onTabChange = undefined as ((tab: RailTabKey) => void) | undefined,
    onHelp = undefined as (() => void) | undefined,
    isMobile = false,
  }: {
    activeTab?: RailTabKey;
    onTabChange?: (tab: RailTabKey) => void;
    onHelp?: () => void;
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

  <!-- 0003: Help is the rail's only bottom control, pinned directly above
       the stable left-region footer row (which owns the collapse/reopen
       control). A single margin-top:auto keeps it at the rail bottom. -->
  <div class="rail-bottom-controls">
    <button
      data-testid="help-btn"
      class="rail-help-btn"
      aria-label="Help"
      title="Keyboard shortcuts"
      onclick={onHelp}
    >
      <CircleQuestionMark size="18" strokeWidth="1.5" ariaLabel="Help" />
    </button>
  </div>
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
    /* Compact caption token: 0.625rem. Labels never wrap or break; long
       labels truncate with an ellipsis inside the 40px rail tab. */
    font-size: var(--text-2xs);
    line-height: 1;
    letter-spacing: 0.02em;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 0003: Help pinned at the rail bottom, directly above the left-region
     footer row (the footer owns the collapse/reopen control). */
  .rail-bottom-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    margin-top: auto;
  }

  .rail-help-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: var(--space-1);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .rail-help-btn:hover {
    color: var(--accent);
    background: var(--surface-hover);
  }

  .rail-help-btn:focus-visible {
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
    .rail-help-btn {
      transition: none;
    }
  }
</style>
