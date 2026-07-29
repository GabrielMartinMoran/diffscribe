<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { WorkspaceListItem } from '$lib/server/application/dto/results/workspace-results';
  import DiffViewer from '$lib/web/components/diff-viewer.svelte';
  import GitContextPanel from '$lib/web/components/git-context-panel.svelte';
  import ObservationPanel from '$lib/web/components/observation-panel.svelte';
  import OpenWorkspaceForm from '$lib/web/components/open-workspace-form.svelte';
  import ReviewPanel from '$lib/web/components/review-panel.svelte';
  import WorkspaceSidebar from '$lib/web/components/workspace-sidebar.svelte';

  // Client-safe comparison draft — matches ComparisonSerialized shape from server
  interface ComparisonDraft {
    base: { type: string; value: string; label: string };
    target: { type: string; value: string; label: string };
    comparisonType: string;
    createdAt: string;
  }

  let { data } = $props();
  let workspaces: WorkspaceListItem[] = $derived(data.workspaces ?? []);
  let activeWorkspaceId: string | null = $derived(data.activeWorkspaceId ?? null);

  let showOpenForm = $state(false);
  let selectedFile = $state<string | null>(null);
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
</script>

<div class="page-layout">
  <div class="sidebar-area">
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
  </div>

  <div class="main-area">
    <ReviewPanel
      {activeWorkspaceId}
      activeReview={data.activeReview ?? null}
      {comparisonDraft}
      {selectedFile}
      fileListEntries={[]}
      {reviewedFilePaths}
      onReviewChange={handleReviewChange}
      onMarkChange={handleMarkChange}
    />

    <div class="content-area">
      <div class="diff-area">
        <GitContextPanel
          gitContext={data.gitContext}
          {activeWorkspaceId}
          {comparisonDraft}
          onFileSelect={(path: string) => (selectedFile = path)}
          onComparisonChange={(draft) => (comparisonDraft = draft)}
          {reviewedFilePaths}
          hasActiveReview={!!data.activeReview}
        />

        <DiffViewer
          {selectedFile}
          {comparisonDraft}
          {activeWorkspaceId}
          onSelectionChange={handleSelectionChange}
        />
      </div>

      {#if data.activeReview}
        <aside class="observation-rail">
          <ObservationPanel
            {activeWorkspaceId}
            activeReview={data.activeReview}
            selectionInfo={lineSelection}
          />
        </aside>
      {/if}
    </div>
  </div>
</div>

<style>
  .page-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    grid-template-rows: 1fr;
    min-height: 100vh;
  }

  .main-area {
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
  }

  .content-area {
    display: grid;
    grid-template-columns: 1fr auto;
    overflow: hidden;
  }

  .diff-area {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .observation-rail {
    width: 320px;
    border-left: 1px solid var(--border-subtle);
    background: var(--surface-primary);
    overflow-y: auto;
  }

  /* Below 1100px: hide rail, show observation panel in drawer */
  @media (max-width: 1100px) {
    .content-area {
      grid-template-columns: 1fr;
    }

    .observation-rail {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      max-height: 40vh;
      border-left: none;
      border-top: 1px solid var(--border-subtle);
      z-index: 10;
    }
  }

  .sidebar-area {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-subtle);
    background: var(--surface-primary);
    overflow-y: auto;
  }

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
</style>
