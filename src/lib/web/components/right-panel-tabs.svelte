<script lang="ts">
  import { FileText, MessageCircle, PanelRightClose, PanelRightOpen } from 'svelte-lucide';

  import type { TabItem } from './ui/Tabs.svelte';
  import Tabs from './ui/Tabs.svelte';

  let {
    activeRightTab = 'comments' as 'comments' | 'review',
    onTabChange = undefined as ((tab: 'comments' | 'review') => void) | undefined,
    rightCollapsed = false,
    onToggleRight = undefined as (() => void) | undefined,
    isMobile = false,
    mobileOpen = false,
    children,
    comments,
    review,
  }: {
    activeRightTab?: 'comments' | 'review';
    onTabChange?: (tab: 'comments' | 'review') => void;
    rightCollapsed?: boolean;
    onToggleRight?: () => void;
    isMobile?: boolean;
    mobileOpen?: boolean;
    children?: import('svelte').Snippet;
    comments?: import('svelte').Snippet;
    review?: import('svelte').Snippet;
  } = $props();

  const tabs: TabItem[] = [
    {
      id: 'comments',
      label: 'Comments',
      ariaLabel: 'Comments',
      icon: MessageCircle,
      testId: 'right-tab-comments',
    },
    {
      id: 'review',
      label: 'Review',
      ariaLabel: 'Review',
      icon: FileText,
      testId: 'right-tab-review',
    },
  ];
</script>

{#if isMobile}
  <!-- Mobile: toggle button + bottom sheet overlay -->
  <button
    data-testid="mobile-right-panel-toggle"
    class="mobile-right-toggle"
    aria-label="Toggle right panel"
    onclick={onToggleRight}
  >
    <PanelRightOpen size="16" strokeWidth="1.5" ariaLabel="Toggle right panel" />
  </button>

  {#if mobileOpen}
    <div
      data-testid="right-panel"
      class="right-panel mobile-sheet"
      role="tabpanel"
      aria-label="Right panel"
    >
      <div class="right-panel-tabs">
        <Tabs
          {tabs}
          activeId={activeRightTab}
          ariaLabel="Right panel tabs"
          onchange={(id) => onTabChange?.(id as 'comments' | 'review')}
        />
        <button
          data-testid="right-panel-collapse-btn"
          class="right-collapse-btn"
          aria-label="Close right panel"
          onclick={onToggleRight}
        >
          <PanelRightClose size="16" strokeWidth="1.5" ariaLabel="Close right panel" />
        </button>
      </div>

      <div class="right-panel-content">
        {#if activeRightTab === 'comments'}
          {#if comments}
            {@render comments()}
          {:else if children}
            {@render children()}
          {/if}
        {:else}
          {#if review}
            {@render review()}
          {:else if children}
            {@render children()}
          {/if}
        {/if}
      </div>
    </div>
  {:else}
    <!-- In mobile when closed, render nothing in the grid -->
  {/if}
{:else if rightCollapsed}
  <div
    data-testid="right-panel"
    class="right-panel-collapsed"
    role="button"
    tabindex="0"
    aria-label="Open right panel"
    onclick={onToggleRight}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleRight?.();
      }
    }}
  >
    <PanelRightOpen size="16" strokeWidth="1.5" ariaLabel="Open right panel" />
  </div>
{:else}
  <div data-testid="right-panel" class="right-panel" role="tabpanel" aria-label="Right panel">
    <div class="right-panel-tabs">
      <Tabs
        {tabs}
        activeId={activeRightTab}
        ariaLabel="Right panel tabs"
        onchange={(id) => onTabChange?.(id as 'comments' | 'review')}
      />
      <button
        data-testid="right-panel-collapse-btn"
        class="right-collapse-btn"
        aria-label="Collapse right panel"
        onclick={onToggleRight}
      >
        <PanelRightClose size="16" strokeWidth="1.5" ariaLabel="Collapse right panel" />
      </button>
    </div>

    <div class="right-panel-content">
      {#if activeRightTab === 'comments'}
        {#if comments}
          {@render comments()}
        {:else if children}
          {@render children()}
        {/if}
      {:else}
        {#if review}
          {@render review()}
        {:else if children}
          {@render children()}
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .right-panel {
    display: flex;
    flex-direction: column;
    width: 320px;
    min-width: 240px;
    border-left: 1px solid var(--border-subtle);
    background: var(--surface-primary);
    overflow: hidden;
    /* Grid item: stay inside the viewport row (scroll ownership). */
    min-height: 0;
  }

  .right-panel-collapsed {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    min-width: 24px;
    border-left: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: color 0.15s;
  }

  .right-panel-collapsed:hover {
    color: var(--accent);
    background: var(--surface-hover);
  }

  .right-panel-collapsed:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .right-panel-tabs {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
  }

  .right-panel-tabs :global(.ui-tabs) {
    flex: 1;
  }

  .right-panel-tabs :global(.ui-tabs__tab) {
    flex: 1;
    min-height: 32px;
    padding: var(--space-2) var(--space-2);
    font-size: var(--text-sm);
  }

  .right-panel-tabs :global(.ui-tabs__tab.active) {
    background: var(--surface-primary);
  }

  .right-collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-right: var(--space-1);
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .right-collapse-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .right-collapse-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .right-panel-content {
    flex: 1;
    overflow-y: auto;
  }

  /* ── Mobile bottom sheet ── */

  .mobile-right-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    min-width: 32px;
    border: none;
    border-left: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: color 0.15s;
  }

  .mobile-right-toggle:hover {
    color: var(--accent);
    background: var(--surface-hover);
  }

  .mobile-right-toggle:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .right-panel.mobile-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 40vh;
    z-index: var(--z-overlay, 300);
    border-left: none;
    border-top: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-lg, 0 -4px 16px rgba(0, 0, 0, 0.12));
    animation: slideUp 0.25s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    .right-panel.mobile-sheet {
      max-height: 50vh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .right-panel-collapsed,
    .right-collapse-btn,
    .mobile-right-toggle,
    .right-panel.mobile-sheet {
      transition: none;
      animation: none;
    }

    .right-panel-tabs :global(.ui-tabs__tab) {
      transition: none;
    }
  }
</style>
