<script lang="ts">
  import { PanelLeftClose } from 'svelte-lucide';

  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';
  import type { WorkspaceListItem } from '$lib/server/application/dto/results/workspace-results';
  import DiffViewer from '$lib/web/components/diff-viewer.svelte';
  import GitContextPanel from '$lib/web/components/git-context-panel.svelte';
  import MobileBackdrop from '$lib/web/components/mobile-backdrop.svelte';
  import ObservationPanel from '$lib/web/components/observation-panel.svelte';
  import OpenFilesTabs from '$lib/web/components/open-files-tabs.svelte';
  import OpenWorkspaceForm from '$lib/web/components/open-workspace-form.svelte';
  import ProjectTree from '$lib/web/components/project-tree.svelte';
  import type { RailTabKey } from '$lib/web/components/rail-tabs.svelte';
  import RailTabs from '$lib/web/components/rail-tabs.svelte';
  import ReviewPanel from '$lib/web/components/review-panel.svelte';
  import RightPanelTabs from '$lib/web/components/right-panel-tabs.svelte';
  import SourceViewer from '$lib/web/components/source-viewer.svelte';
  import ThemeSwitcher from '$lib/web/components/theme-switcher.svelte';
  import WorkspaceSidebar from '$lib/web/components/workspace-sidebar.svelte';
  import {
    activeFilePath,
    clearActiveFile,
    setActiveFile,
  } from '$lib/web/stores/active-file-store';
  import {
    LEFT_PANEL_MAX,
    LEFT_PANEL_MIN,
    panelLayout,
    resetLayout,
    RIGHT_PANEL_MAX,
    RIGHT_PANEL_MIN,
    setLeftWidth,
    setRightWidth,
    toggleLeft,
    toggleRight,
  } from '$lib/web/stores/panel-layout-store';
  import type { ComparisonDraft } from '$lib/web/types/comparison-draft';

  let { data } = $props();
  let workspaces: WorkspaceListItem[] = $derived(data.workspaces ?? []);
  let activeWorkspaceId: string | null = $derived(data.activeWorkspaceId ?? null);

  // ─── Shell state ───
  let activeRailTab = $state<RailTabKey>('workspaces');
  let activeRightTab = $state<'comments' | 'review'>('comments');

  // ─── Responsive state ───
  let isMobileViewport = $state(false);
  let mobileLeftOpen = $state(false);
  let mobileRightOpen = $state(false);
  // Track which rail tab trigger opened the mobile drawer for focus return
  let lastLeftTrigger: RailTabKey | null = null;

  // Detect mobile viewport via media query (breakpoints from design.md: compact <=768)
  $effect(() => {
    if (!browser) return;
    const mql = window.matchMedia('(max-width: 768px)');
    isMobileViewport = mql.matches;

    const handler = (e: MediaQueryListEvent) => {
      isMobileViewport = e.matches;
      // Close any open mobile drawers on breakpoint transition
      if (!e.matches) {
        mobileLeftOpen = false;
        mobileRightOpen = false;
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  });

  // Handle Escape key to close mobile drawers
  $effect(() => {
    if (!browser) return;
    if (!mobileLeftOpen && !mobileRightOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeAllMobile();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  // Close all mobile drawers/sheets
  function closeAllMobile() {
    const wasLeftOpen = mobileLeftOpen;
    const wasRightOpen = mobileRightOpen;
    mobileLeftOpen = false;
    mobileRightOpen = false;

    // Return focus to the trigger element
    if (wasLeftOpen && lastLeftTrigger) {
      const triggerEl = document.querySelector(`[data-testid="rail-tab-${lastLeftTrigger}"]`);
      if (triggerEl instanceof HTMLElement) {
        triggerEl.focus();
      }
    } else if (wasRightOpen) {
      const toggleEl = document.querySelector('[data-testid="mobile-right-panel-toggle"]');
      if (toggleEl instanceof HTMLElement) {
        toggleEl.focus();
      }
    }
  }

  // ─── Existing state (preserved for backward compat) ───
  let showOpenForm = $state(false);
  let comparisonDraft = $state<ComparisonDraft | null>(null);
  let reviewedFilePaths = $state<string[]>([]);
  let lineSelection = $state<{
    filePath: string;
    side: string;
    startLine: number;
    endLine: number;
    rawSnapshot: string;
  } | null>(null);

  // Initialize comparison draft from default on first load
  $effect(() => {
    if (!comparisonDraft && data.gitContext?.defaultComparison) {
      comparisonDraft = data.gitContext.defaultComparison as unknown as ComparisonDraft;
    }
  });

  function handleMarkChange(filePath: string, marked: boolean) {
    if (marked) {
      reviewedFilePaths = [...new Set([...reviewedFilePaths, filePath])];
    } else {
      reviewedFilePaths = reviewedFilePaths.filter((p) => p !== filePath);
    }
  }

  function handleReviewChange() {
    invalidateAll();
  }

  function handleSelectionChange(
    sel: {
      filePath: string;
      side: string;
      startLine: number;
      endLine: number;
      rawSnapshot: string;
    } | null,
  ) {
    lineSelection = sel;
  }

  function handleFileSelect(path: string) {
    setActiveFile(path);
  }

  function handleCloseFile(path: string) {
    if (path) {
      clearActiveFile();
    }
  }

  function handleComparisonChange(draft: ComparisonDraft) {
    comparisonDraft = draft;
  }

  // ─── Mobile-specific handlers ───

  function handleMobileTabChange(tab: RailTabKey) {
    activeRailTab = tab;
    lastLeftTrigger = tab;
    mobileLeftOpen = true;
  }

  function handleCloseMobileLeft() {
    closeAllMobile();
  }

  function handleToggleMobileRight() {
    mobileRightOpen = !mobileRightOpen;
  }

  // ─── Panel resize handlers ───

  function startLeftResize(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = $panelLayout.leftWidth;

    function onMove(e: MouseEvent) {
      const delta = e.clientX - startX;
      setLeftWidth(startWidth + delta);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleLeftResizeKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 20 : 10;
    let newWidth = $panelLayout.leftWidth;

    if (event.key === 'ArrowRight') {
      newWidth = Math.min(LEFT_PANEL_MAX, newWidth + step);
    } else if (event.key === 'ArrowLeft') {
      newWidth = Math.max(LEFT_PANEL_MIN, newWidth - step);
    } else if (event.key === 'Home') {
      newWidth = LEFT_PANEL_MIN;
    } else if (event.key === 'End') {
      newWidth = LEFT_PANEL_MAX;
    } else {
      return;
    }

    event.preventDefault();
    setLeftWidth(newWidth);
  }

  function startRightResize(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = $panelLayout.rightWidth;

    function onMove(e: MouseEvent) {
      const delta = startX - e.clientX;
      setRightWidth(startWidth + delta);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleRightResizeKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 20 : 10;
    let newWidth = $panelLayout.rightWidth;

    if (event.key === 'ArrowLeft') {
      newWidth = Math.min(RIGHT_PANEL_MAX, newWidth + step);
    } else if (event.key === 'ArrowRight') {
      newWidth = Math.max(RIGHT_PANEL_MIN, newWidth - step);
    } else if (event.key === 'Home') {
      newWidth = RIGHT_PANEL_MIN;
    } else if (event.key === 'End') {
      newWidth = RIGHT_PANEL_MAX;
    } else {
      return;
    }

    event.preventDefault();
    setRightWidth(newWidth);
  }
</script>

<div
  data-testid="shell-layout"
  class="shell-layout"
  class:is-mobile={isMobileViewport}
  style={isMobileViewport
    ? ''
    : '--left-panel-width: ' +
      ($panelLayout.leftCollapsed ? '0px' : $panelLayout.leftWidth + 'px') +
      '; --right-panel-width: ' +
      ($panelLayout.rightCollapsed ? '0px' : $panelLayout.rightWidth + 'px')}
>
  <!-- Left rail -->
  <RailTabs
    activeTab={activeRailTab}
    onTabChange={isMobileViewport ? handleMobileTabChange : (t) => (activeRailTab = t)}
    leftCollapsed={$panelLayout.leftCollapsed || isMobileViewport}
    onToggleLeft={isMobileViewport ? () => handleMobileTabChange(activeRailTab) : toggleLeft}
    isMobile={isMobileViewport}
  />

  <!-- Left contextual panel (desktop: in grid; mobile: overlay drawer) -->
  <aside
    data-testid="left-contextual-panel"
    class="left-contextual-panel"
    class:collapsed={$panelLayout.leftCollapsed || isMobileViewport}
    class:mobile-drawer={isMobileViewport}
    class:mobile-drawer-open={isMobileViewport && mobileLeftOpen}
    aria-hidden={isMobileViewport && !mobileLeftOpen}
    role={isMobileViewport ? 'dialog' : undefined}
  >
    {#if isMobileViewport}
      <div class="left-panel-header">
        <ThemeSwitcher />
        <button
          data-testid="left-panel-collapse-btn"
          class="left-collapse-btn"
          aria-label="Close left panel"
          onclick={handleCloseMobileLeft}
        >
          <PanelLeftClose size="14" strokeWidth="1.5" ariaLabel="Close left panel" />
        </button>
      </div>
    {:else}
      <div class="left-panel-header">
        <ThemeSwitcher />
        <button
          data-testid="left-panel-collapse-btn"
          class="left-collapse-btn"
          aria-label="Collapse left panel"
          onclick={toggleLeft}
        >
          <PanelLeftClose size="14" strokeWidth="1.5" ariaLabel="Collapse left panel" />
        </button>
      </div>
    {/if}

    {#if activeRailTab === 'workspaces'}
      <WorkspaceSidebar {workspaces} {activeWorkspaceId} />

      <div class="sidebar-actions">
        <button
          class="open-btn"
          data-testid="open-workspace-toggle"
          aria-label="Open Workspace"
          onclick={() => (showOpenForm = !showOpenForm)}
          aria-expanded={showOpenForm}
        >
          {showOpenForm ? 'Close' : 'Open Workspace'}
        </button>
      </div>

      {#if showOpenForm}
        <div class="open-form-wrapper">
          <OpenWorkspaceForm onRegistered={() => (showOpenForm = false)} />
        </div>
      {/if}
    {:else if activeRailTab === 'project'}
      <ProjectTree {activeWorkspaceId} {comparisonDraft} />
    {:else if activeRailTab === 'git'}
      <GitContextPanel
        gitContext={data.gitContext}
        {activeWorkspaceId}
        {comparisonDraft}
        onFileSelect={handleFileSelect}
        onComparisonChange={handleComparisonChange}
        {reviewedFilePaths}
        hasActiveReview={!!data.activeReview}
      />
    {/if}
  </aside>

  <!-- Center content -->
  <main data-testid="center-content" class="center-content">
    <OpenFilesTabs onCloseFile={handleCloseFile} />

    <div class="work-area">
      {#if $activeFilePath && activeRailTab === 'project'}
        <div class="diff-area">
          <SourceViewer filePath={$activeFilePath} {activeWorkspaceId} {comparisonDraft} />
        </div>
      {:else}
        <div class="diff-area">
          <DiffViewer
            selectedFile={$activeFilePath ?? null}
            {comparisonDraft}
            {activeWorkspaceId}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      {/if}
    </div>
  </main>

  <!-- Left resize handle (overlay between left panel and center) -->
  {#if !$panelLayout.leftCollapsed && !isMobileViewport}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      data-testid="left-resize-handle"
      class="resize-handle left-resize-handle"
      role="separator"
      aria-label="Resize left panel"
      aria-valuenow={$panelLayout.leftWidth}
      aria-valuemin={LEFT_PANEL_MIN}
      aria-valuemax={LEFT_PANEL_MAX}
      tabindex="0"
      onmousedown={startLeftResize}
      onkeydown={handleLeftResizeKeydown}
    ></div>
  {/if}

  <!-- Right resize handle (overlay between center and right panel) -->
  {#if !$panelLayout.rightCollapsed && !isMobileViewport}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      data-testid="right-resize-handle"
      class="resize-handle right-resize-handle"
      role="separator"
      aria-label="Resize right panel"
      aria-valuenow={$panelLayout.rightWidth}
      aria-valuemin={RIGHT_PANEL_MIN}
      aria-valuemax={RIGHT_PANEL_MAX}
      tabindex="0"
      onmousedown={startRightResize}
      onkeydown={handleRightResizeKeydown}
    ></div>
  {/if}

  <!-- Reset layout button (hidden on mobile) -->
  {#if !isMobileViewport}
    <button
      data-testid="reset-layout-btn"
      class="reset-layout-btn"
      aria-label="Reset panel layout"
      onclick={resetLayout}
    >
      Reset Layout
    </button>
  {/if}

  <!-- Right panel (desktop: in grid; mobile: bottom sheet toggle) -->
  <RightPanelTabs
    {activeRightTab}
    onTabChange={(t) => (activeRightTab = t)}
    rightCollapsed={$panelLayout.rightCollapsed}
    onToggleRight={isMobileViewport ? handleToggleMobileRight : toggleRight}
    isMobile={isMobileViewport}
    mobileOpen={mobileRightOpen}
  >
    {#snippet comments()}
      <ObservationPanel
        {activeWorkspaceId}
        activeReview={data.activeReview ?? null}
        selectionInfo={lineSelection}
      />
    {/snippet}
    {#snippet review()}
      <ReviewPanel
        {activeWorkspaceId}
        activeReview={data.activeReview ?? null}
        {comparisonDraft}
        selectedFile={$activeFilePath ?? null}
        fileListEntries={[]}
        {reviewedFilePaths}
        onReviewChange={handleReviewChange}
        onMarkChange={handleMarkChange}
      />
    {/snippet}
  </RightPanelTabs>
</div>

<!-- Mobile backdrop (outside shell-layout so it overlays properly) -->
<MobileBackdrop
  visible={isMobileViewport && (mobileLeftOpen || mobileRightOpen)}
  onClose={closeAllMobile}
  label="Close panel"
/>

<style>
  .shell-layout {
    position: relative;
    display: grid;
    grid-template-columns: 48px var(--left-panel-width, 300px) 1fr var(--right-panel-width, 320px);
    grid-template-rows: 1fr;
    min-height: 100dvh;
    overflow: hidden;
  }

  /* ── Mobile grid: rail + center only ── */

  .shell-layout.is-mobile {
    grid-template-columns: 48px 1fr;
  }

  /* ─── Left panel (desktop) ─── */

  .left-contextual-panel {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-subtle);
    background: var(--surface-primary);
    overflow: hidden;
  }

  .left-contextual-panel:not(.collapsed) {
    min-width: 200px;
  }

  .left-contextual-panel.collapsed {
    min-width: 0;
    border-right: none;
  }

  /* ── Left panel (mobile drawer) ── */

  .left-contextual-panel.mobile-drawer {
    position: fixed;
    top: 0;
    left: 0;
    width: 85vw;
    max-width: 320px;
    height: 100dvh;
    z-index: calc(var(--z-overlay, 300) + 1);
    border-right: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-lg, 4px 0 16px rgba(0, 0, 0, 0.12));
    transform: translateX(-100%);
    transition: transform 0.25s var(--ease-default, ease-out);
    min-width: 0;
  }

  .left-contextual-panel.mobile-drawer.mobile-drawer-open {
    transform: translateX(0);
  }

  /* Hide left panel contents when drawer is closed on mobile */

  .left-contextual-panel.mobile-drawer:not(.mobile-drawer-open) {
    visibility: hidden;
    pointer-events: none;
  }

  .left-contextual-panel.mobile-drawer.mobile-drawer-open {
    visibility: visible;
    pointer-events: auto;
  }

  .left-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
  }

  .left-collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
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

  .left-collapse-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .left-collapse-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  /* ─── Resize handles ─── */

  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    background: transparent;
    transition: background 0.15s;
  }

  .resize-handle:hover,
  .resize-handle:focus-visible {
    background: var(--accent);
  }

  .left-resize-handle {
    left: calc(48px + var(--left-panel-width, 300px));
  }

  .right-resize-handle {
    right: var(--right-panel-width, 320px);
  }

  /* ─── Reset layout button ─── */

  .reset-layout-btn {
    position: fixed;
    bottom: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    cursor: pointer;
    z-index: 20;
    opacity: 0.6;
    transition:
      opacity 0.15s,
      color 0.15s;
  }

  .reset-layout-btn:hover {
    opacity: 1;
    color: var(--accent);
    border-color: var(--accent);
  }

  .reset-layout-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    opacity: 1;
  }

  /* ─── Center content ─── */

  .center-content {
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    min-width: 0;
  }

  .work-area {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .diff-area {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ─── Sidebar actions ─── */

  .sidebar-actions {
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border-subtle);
  }

  .open-btn {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .open-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .open-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .open-form-wrapper {
    padding: var(--space-3);
  }

  .open-form-wrapper :global(form) {
    margin: 0;
  }

  /* ── Ensure no page-level horizontal overflow ── */

  .shell-layout {
    max-width: 100vw;
  }

  /* ─── Reduced motion ─── */

  @media (prefers-reduced-motion: reduce) {
    .left-contextual-panel.mobile-drawer {
      transition: none;
    }

    .left-collapse-btn,
    .resize-handle,
    .reset-layout-btn {
      transition: none;
    }
  }
</style>
