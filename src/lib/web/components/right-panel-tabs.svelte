<script lang="ts">
  import { FileText, MessageCircle, PanelRightClose, PanelRightOpen } from 'svelte-lucide';

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
      <div class="right-panel-tabs" role="tablist" aria-label="Right panel tabs">
        <button
          role="tab"
          aria-selected={activeRightTab === 'comments'}
          aria-label="Comments"
          data-testid="right-tab-comments"
          class="right-tab"
          class:active={activeRightTab === 'comments'}
          onclick={() => onTabChange?.('comments')}
        >
          <MessageCircle size="16" strokeWidth="1.5" ariaLabel="Comments" />
          <span>Comments</span>
        </button>
        <button
          role="tab"
          aria-selected={activeRightTab === 'review'}
          aria-label="Review"
          data-testid="right-tab-review"
          class="right-tab"
          class:active={activeRightTab === 'review'}
          onclick={() => onTabChange?.('review')}
        >
          <FileText size="16" strokeWidth="1.5" ariaLabel="Review" />
          <span>Review</span>
        </button>
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
    <div class="right-panel-tabs" role="tablist" aria-label="Right panel tabs">
      <button
        role="tab"
        aria-selected={activeRightTab === 'comments'}
        aria-label="Comments"
        data-testid="right-tab-comments"
        class="right-tab"
        class:active={activeRightTab === 'comments'}
        onclick={() => onTabChange?.('comments')}
      >
        <MessageCircle size="16" strokeWidth="1.5" ariaLabel="Comments" />
        <span>Comments</span>
      </button>
      <button
        role="tab"
        aria-selected={activeRightTab === 'review'}
        aria-label="Review"
        data-testid="right-tab-review"
        class="right-tab"
        class:active={activeRightTab === 'review'}
        onclick={() => onTabChange?.('review')}
      >
        <FileText size="16" strokeWidth="1.5" ariaLabel="Review" />
        <span>Review</span>
      </button>
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

  .right-tab {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex: 1;
    padding: var(--space-2) var(--space-2);
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    cursor: pointer;
    justify-content: center;
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;
  }

  .right-tab:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .right-tab:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .right-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
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
    .right-tab,
    .right-panel-collapsed,
    .right-collapse-btn,
    .mobile-right-toggle,
    .right-panel.mobile-sheet {
      transition: none;
      animation: none;
    }
  }
</style>
