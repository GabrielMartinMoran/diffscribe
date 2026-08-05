<script lang="ts">
  import { FileText, MessageCircle, PanelRightClose, PanelRightOpen } from 'svelte-lucide';

  import { tabButtonId, tabPanelId } from './ui/ids';
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

  // Strip tab activation expands the panel and selects the tab at once.
  function handleStripTabChange(id: string) {
    onTabChange?.(id as 'comments' | 'review');
    onToggleRight?.();
  }

  // When the panel collapses, return focus to the active tab in the strip so
  // keyboard users keep their position; when it expands (strip tab or reopen
  // button), return focus to the active tab button of the expanded branch.
  // Both branches reuse the same deterministic tabButtonId() ids.
  let wasCollapsed = $state(rightCollapsed);
  $effect(() => {
    const collapsed = rightCollapsed;
    if (collapsed !== wasCollapsed) {
      requestAnimationFrame(() => {
        document.getElementById(tabButtonId(activeRightTab))?.focus();
      });
    }
    wasCollapsed = collapsed;
  });
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
      id={tabPanelId(activeRightTab)}
      aria-labelledby={tabButtonId(activeRightTab)}
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
  <!-- Collapsed desktop strip: 48 px vertical tablist. Activating a tab
       expands the panel and selects the tab at once. W9: a bottom expand
       control reopens the panel without changing the tab. The wrapper
       carries no tablist role: exactly one tablist exists, the inner
       vertical one rendered by the shared Tabs kit. -->
  <div data-testid="right-panel" class="right-panel-strip-wrap">
    <Tabs
      {tabs}
      activeId={activeRightTab}
      orientation="vertical"
      ariaLabel="Right panel tabs"
      class="right-panel-strip"
      onchange={handleStripTabChange}
    />
    <button
      data-testid="right-panel-reopen-btn"
      class="right-strip-reopen-btn"
      aria-label="Open right panel"
      title="Open right panel"
      onclick={onToggleRight}
    >
      <PanelRightOpen size="18" strokeWidth="1.5" ariaLabel="Open right panel" />
    </button>
  </div>
{:else}
  <div data-testid="right-panel" class="right-panel">
    <div class="right-panel-body">
      <!-- 0003: desktop expanded navigation sits on the panel's RIGHT edge.
           row-reverse keeps the DOM/keyboard order (nav first, content
           second) while the nav column renders at the far right. The
           separator border flips to the nav's inner (left) side and the
           active indicator flips to the outer (right) edge. The wrapper
           carries no tablist role: the kit renders exactly one tablist,
           and each tab's aria-controls resolves to a real consumer-rendered
           tabpanel below. -->
      <div class="right-panel-nav">
        <Tabs
          {tabs}
          activeId={activeRightTab}
          orientation="vertical"
          ariaLabel="Right panel tabs"
          class="right-panel-nav-tabs"
          onchange={(id) => onTabChange?.(id as 'comments' | 'review')}
        />
      </div>

      <div class="right-panel-content">
        <!-- Real tabpanels: both stay mounted so inactive Comments/Review
             state and scroll survive tab switches; the inactive panel is
             hidden. aria-labelledby points back at the tab button. -->
        <div
          id={tabPanelId('comments')}
          role="tabpanel"
          aria-labelledby={tabButtonId('comments')}
          tabindex={activeRightTab === 'comments' ? 0 : -1}
          class="right-tabpanel"
          hidden={activeRightTab !== 'comments'}
        >
          {#if comments}
            {@render comments()}
          {:else if children}
            {@render children()}
          {/if}
        </div>
        <div
          id={tabPanelId('review')}
          role="tabpanel"
          aria-labelledby={tabButtonId('review')}
          tabindex={activeRightTab === 'review' ? 0 : -1}
          class="right-tabpanel"
          hidden={activeRightTab !== 'review'}
        >
          {#if review}
            {@render review()}
          {:else if children}
            {@render children()}
          {/if}
        </div>
      </div>
    </div>

    <!-- W9: desktop collapse control lives in the bottom footer. -->
    <div class="right-panel-footer">
      <button
        data-testid="right-panel-collapse-btn"
        class="right-collapse-btn"
        aria-label="Collapse right panel"
        title="Collapse right panel"
        onclick={onToggleRight}
      >
        <PanelRightClose size="16" strokeWidth="1.5" ariaLabel="Collapse right panel" />
      </button>
    </div>
  </div>
{/if}

<style>
  .right-panel {
    display: flex;
    flex-direction: column;
    /* Fill the grid column the shell assigns via --right-panel-width. The
       panel must follow the resize handle; a fixed pixel width would leave
       a gap at the viewport edge after growing or overflow after shrinking.
       border-box keeps the 1 px left border inside the column so the panel
       right edge stays flush with the viewport edge. The mobile sheet
       below overrides width for the fixed bottom sheet. */
    width: 100%;
    min-width: 240px;
    box-sizing: border-box;
    border-left: 1px solid var(--border-subtle);
    background: var(--surface-primary);
    overflow: hidden;
    /* Grid item: stay inside the viewport row (scroll ownership). */
    min-height: 0;
  }

  /* ── Expanded panel (desktop): nav column + content row ── */

  .right-panel-body {
    display: flex;
    /* 0003: nav renders at the panel's right edge without changing DOM or
       keyboard order (content follows the nav in the DOM; visually reversed
       by row-reverse). */
    flex-direction: row-reverse;
    flex: 1;
    min-height: 0;
  }

  .right-panel-nav {
    width: 48px;
    min-width: 48px;
    flex-shrink: 0;
    /* Inner side of the right-edge nav: the separator sits on the nav's
       left, between the content and the icons. */
    border-left: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
    overflow-y: auto;
  }

  :global(.right-panel-nav-tabs) {
    flex-direction: column;
  }

  :global(.right-panel-nav-tabs.ui-tabs--vertical .ui-tabs__tab) {
    width: 48px;
    height: 48px;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-1) 0;
    /* The kit's vertical default puts the indicator on the left; the
       right-edge nav moves it to the right. */
    border-left: none;
    border-right: 2px solid transparent;
  }

  :global(.right-panel-nav-tabs.ui-tabs--vertical .ui-tabs__tab.active) {
    /* Outer edge indicator: the active accent bar sits on the right edge. */
    border-left: none;
    border-right-color: var(--accent);
    background: var(--accent-light);
  }

  :global(.right-panel-nav-tabs .ui-tabs__label) {
    font-size: var(--text-2xs);
    line-height: 1;
    letter-spacing: 0.02em;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .right-tabpanel {
    height: 100%;
    min-height: 0;
  }

  /* ── Collapsed strip (desktop) ── */

  .right-panel-strip-wrap {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 48px;
    min-width: 48px;
    border-left: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
  }

  :global(.right-panel-strip) {
    flex-direction: column;
  }

  :global(.right-panel-strip .ui-tabs__tab) {
    width: 48px;
    height: 48px;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-1) 0;
    border-left: 2px solid transparent;
  }

  :global(.right-panel-strip .ui-tabs__tab.active) {
    border-left-color: var(--accent);
    background: var(--accent-light);
  }

  :global(.right-panel-strip .ui-tabs__label) {
    font-size: var(--text-2xs);
    line-height: 1;
    letter-spacing: 0.02em;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
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

  /* ── W9: bottom footers ── */

  .right-panel-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
    flex-shrink: 0;
  }

  .right-strip-reopen-btn {
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

  .right-strip-reopen-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
  }

  .right-strip-reopen-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .right-panel-content {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
  }

  /* ── Mobile bottom sheet ── */

  .mobile-right-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    min-width: 32px;
    /* Grid row stretch + explicit height: the toggle is a full-height right
       column (>= 24x24 target) and never collapses into an implicit row. */
    height: 100%;
    /* Above the backdrop so the toggle stays usable while the sheet is open
       (the sheet wins over the toggle only inside its own box, later DOM). */
    z-index: var(--z-overlay, 300);
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
