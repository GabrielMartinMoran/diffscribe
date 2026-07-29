<script lang="ts">
  import { Files, Folder, GitBranch, PanelLeftOpen } from 'svelte-lucide';

  export type RailTabKey = 'workspaces' | 'project' | 'git';

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

  const tabs: Array<{ key: RailTabKey; label: string; icon: typeof Files }> = [
    { key: 'workspaces', label: 'Workspaces', icon: Files },
    { key: 'project', label: 'Project', icon: Folder },
    { key: 'git', label: 'Git', icon: GitBranch },
  ];

  let tabRefs: (HTMLButtonElement | null)[] = [];

  function handleKeydown(e: KeyboardEvent) {
    const currentIndex = tabs.findIndex((t) => t.key === activeTab);
    let nextIndex: number;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextKey = tabs[nextIndex].key;
    onTabChange?.(nextKey);
    tabRefs[nextIndex]?.focus();
  }
</script>

<div
  data-testid="rail-tabs"
  class="rail-tabs"
  class:is-mobile={isMobile}
  role="tablist"
  aria-label="Navigation tabs"
  tabindex="-1"
  onkeydown={handleKeydown}
>
  {#each tabs as { key, label, icon: Icon }, i (key)}
    <button
      role="tab"
      aria-selected={activeTab === key}
      aria-label={label}
      data-testid="rail-tab-{key}"
      class="rail-tab"
      class:active={activeTab === key}
      bind:this={tabRefs[i]}
      onclick={() => onTabChange?.(key)}
    >
      <Icon size="18" strokeWidth="1.5" ariaLabel={label} />
      <span class="tab-label">{label}</span>
    </button>
  {/each}

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
  }

  .rail-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 40px;
    height: 48px;
    padding: var(--space-1) 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .rail-tab:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .rail-tab:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .rail-tab.active {
    color: var(--accent);
    background: var(--accent-light, rgba(66, 133, 244, 0.1));
  }

  .tab-label {
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

  .rail-tabs.is-mobile .tab-label {
    display: none;
  }

  .rail-tabs.is-mobile .rail-tab {
    height: 40px;
    width: 40px;
  }

  @media (max-width: 768px) {
    .tab-label {
      display: none;
    }

    .rail-tab {
      height: 40px;
      width: 40px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rail-tab,
    .rail-reopen-btn {
      transition: none;
    }
  }
</style>
