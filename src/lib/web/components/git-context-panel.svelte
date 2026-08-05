<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type {
    FileListEntry,
    FileListResult,
  } from '$lib/server/application/dto/results/file-list-results';
  import type { GitContextAggregate } from '$lib/server/application/services/get-git-context-use-case';
  import BranchSelectPopup from '$lib/web/components/branch-select-popup.svelte';
  import FileList from '$lib/web/components/file-list.svelte';
  import { projectTreeLoader } from '$lib/web/services/project-tree-loader';
  import { type GitRefLike, inferComparisonType } from '$lib/web/types/comparison-inference';
  import { createRequestGuard, type RequestGuard } from '$lib/web/utils/request-guard';

  // Branches arrive pre-sorted by the reader (sortBranches, tranche C):
  // Local group first, Cached remote second, committerDate descending
  // within a group, canonicalRef ascending tie-break. The panel never
  // re-sorts and never shows full refs in the UI.

  // Client-safe draft type — no runtime imports from $lib/server.
  // ComparisonSerialized is a server DTO; on the wire, comparisonType is a string.
  interface ComparisonDraft {
    base: { type: string; value: string; label: string };
    target: { type: string; value: string; label: string };
    comparisonType: string;
    createdAt: string;
  }

  let {
    gitContext = null as GitContextAggregate | null,
    activeWorkspaceId = null as string | null,
    comparisonDraft = null as ComparisonDraft | null,
    onFileSelect = undefined as ((path: string, newTab?: boolean) => void) | undefined,
    onComparisonChange = undefined as ((draft: ComparisonDraft) => void) | undefined,
    reviewedFilePaths = [] as string[],
    hasActiveReview = false,
  }: {
    gitContext: GitContextAggregate | null;
    activeWorkspaceId: string | null;
    comparisonDraft?: ComparisonDraft | null;
    onFileSelect?: (path: string, newTab?: boolean) => void;
    onComparisonChange?: (draft: ComparisonDraft) => void;
    reviewedFilePaths?: string[];
    hasActiveReview?: boolean;
  } = $props();

  // Base/Target popup state: opening one trigger closes the other.
  let openSlot = $state<'base' | 'target' | null>(null);
  let baseTriggerRef = $state<HTMLElement | null>(null);
  let targetTriggerRef = $state<HTMLElement | null>(null);
  let commitFilter = $state('');
  let refreshing = $state(false);
  let retrying = $state(false);
  // Visible refresh error (network/HTTP/server failure). The last good
  // context stays rendered while this banner is shown with a Retry action.
  let refreshError = $state<string | null>(null);

  // Monotonic request guards: stale responses can never overwrite newer
  // file-list or refresh state (tranche C).
  const fileListGuard: RequestGuard = createRequestGuard();
  const refreshGuard: RequestGuard = createRequestGuard();

  // Internal comparison draft — initialized from parent prop or gitContext default
  let internalDraft = $state<ComparisonDraft | null>(null);

  // File list state
  let fileListEntries = $state<FileListEntry[]>([]);
  let fileListLoading = $state(false);
  let fileListError = $state<string | null>(null);

  $effect(() => {
    // Sync from parent prop when it changes
    if (comparisonDraft) {
      internalDraft = comparisonDraft;
    } else if (gitContext?.defaultComparison) {
      internalDraft = gitContext.defaultComparison as unknown as ComparisonDraft;
    }
  });

  // Notify parent when draft changes
  $effect(() => {
    if (internalDraft) {
      onComparisonChange?.(internalDraft);
    }
  });

  // Fetch file list when comparison draft changes
  $effect(() => {
    if (internalDraft && activeWorkspaceId) {
      fetchFileList(internalDraft);
    }
  });

  async function fetchFileList(draft: ComparisonDraft) {
    if (!activeWorkspaceId) return;
    const generation = fileListGuard.begin();
    fileListLoading = true;
    fileListError = null;
    try {
      const comparisonParam = encodeURIComponent(JSON.stringify(draft));
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/file-list?comparison=${comparisonParam}`,
      );
      if (!fileListGuard.isCurrent(generation)) return;
      const data: FileListResult = await res.json();
      if (!fileListGuard.isCurrent(generation)) return;
      if (data.error) {
        fileListError = data.error.message;
        fileListEntries = [];
      } else {
        fileListEntries = data.entries;
      }
    } catch (e: unknown) {
      if (!fileListGuard.isCurrent(generation)) return;
      fileListError = e instanceof Error ? e.message : 'Failed to load file list';
      fileListEntries = [];
    } finally {
      if (fileListGuard.isCurrent(generation)) {
        fileListLoading = false;
      }
    }
  }

  function filteredCommits() {
    if (!gitContext?.commits) return [];
    const filter = commitFilter.toLowerCase();
    return gitContext.commits.filter(
      (c) => c.message.toLowerCase().includes(filter) || c.shortHash.toLowerCase().includes(filter),
    );
  }

  /** Visible label for a canonical ref; falls back to the ref itself. */
  function branchLabelByCanonical(canonicalRef: string): string {
    const found = gitContext?.branches.find((b) => b.canonicalRef === canonicalRef);
    return found?.name ?? canonicalRef;
  }

  /**
   * Selects a branch for a slot using its canonical ref as the draft value
   * (local "origin/main" and cached remote "origin/main" never collide) and
   * the visible short label for display. Selecting a target auto-activates
   * the Base slot with the current branch when the draft default (HEAD) has
   * not been touched; a user-chosen base is preserved. The draft updates in
   * memory — no checkout or repository mutation happens.
   */
  function selectBranchByCanonical(canonicalRef: string, slot: 'base' | 'target') {
    if (!internalDraft) return;
    const updated = { ...internalDraft };
    const label = branchLabelByCanonical(canonicalRef);
    if (slot === 'base') {
      updated.base = { type: 'branch' as const, value: canonicalRef, label };
    } else {
      if (isDefaultBase(updated.base)) {
        const current = gitContext?.branches.find((b) => b.isCurrent)?.canonicalRef;
        const currentBranch = gitContext?.status?.currentBranch;
        updated.base = current
          ? { type: 'branch' as const, value: current, label: currentBranch ?? current }
          : { type: 'head' as const, value: 'HEAD', label: 'HEAD' };
      }
      updated.target = { type: 'branch' as const, value: canonicalRef, label };
    }
    updated.comparisonType = inferComparisonType(
      { type: updated.base.type as GitRefLike['type'], value: updated.base.value },
      { type: updated.target.type as GitRefLike['type'], value: updated.target.value },
    );
    internalDraft = updated;
  }

  /**
   * W8: select the working tree as the target. The target becomes the fixed
   * working-tree ref; the type is inferred (working-tree-vs-head with the
   * untouched HEAD base, branch-vs-working-tree otherwise).
   */
  function selectWorkingTree() {
    if (!internalDraft) return;
    const updated = { ...internalDraft };
    updated.target = {
      type: 'working-tree' as const,
      value: 'WORKING_TREE',
      label: 'Working tree',
    };
    updated.comparisonType = inferComparisonType(
      { type: updated.base.type as GitRefLike['type'], value: updated.base.value },
      { type: updated.target.type as GitRefLike['type'], value: updated.target.value },
    );
    internalDraft = updated;
  }

  const isWorkingTreeTarget = $derived(
    internalDraft?.target.type === 'working-tree' || internalDraft?.target.label === 'Working tree',
  );

  function selectCommit(shortHash: string) {
    if (!openSlot || !internalDraft) return;
    const updated = { ...internalDraft };
    if (openSlot === 'base') {
      updated.base = { type: 'commit' as const, value: shortHash, label: shortHash };
    } else {
      if (isDefaultBase(updated.base)) {
        const current = gitContext?.status?.currentBranch;
        updated.base = current
          ? { type: 'branch' as const, value: current, label: current }
          : { type: 'head' as const, value: 'HEAD', label: 'HEAD' };
      }
      updated.target = { type: 'commit' as const, value: shortHash, label: shortHash };
    }
    updated.comparisonType = inferComparisonType(
      { type: updated.base.type as GitRefLike['type'], value: updated.base.value },
      { type: updated.target.type as GitRefLike['type'], value: updated.target.value },
    );
    internalDraft = updated;
  }

  /** True when the base is the untouched draft default (HEAD). */
  function isDefaultBase(base: ComparisonDraft['base']): boolean {
    return base.type === 'head' && base.value === 'HEAD';
  }

  async function refresh() {
    if (!activeWorkspaceId) return;
    const generation = refreshGuard.begin();
    refreshing = true;
    refreshError = null;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git-context`);
      if (!refreshGuard.isCurrent(generation)) return;
      const data = await res.json();
      if (!refreshGuard.isCurrent(generation)) return;
      if (data.error) {
        // Server-side failure: keep the last good context visible and
        // surface the error with a Retry instead of discarding branches
        // or status (tranche C).
        refreshError =
          typeof data.error === 'string' ? data.error : (data.error.message ?? 'Refresh failed');
        return;
      }
      gitContext = data;
      // Successful refresh: the repository content may have changed, so the
      // cached Project tree for this workspace is invalidated (targeted,
      // pending-safe; other workspaces untouched). No refetch happens here —
      // the next Project rail / Quick Open load starts one fresh request.
      projectTreeLoader.invalidate(activeWorkspaceId);
    } catch (e: unknown) {
      if (!refreshGuard.isCurrent(generation)) return;
      refreshError = e instanceof Error ? e.message : 'Failed to refresh Git context';
    } finally {
      if (refreshGuard.isCurrent(generation)) {
        refreshing = false;
      }
    }
  }

  async function retryContext() {
    if (!activeWorkspaceId) return;
    retrying = true;
    try {
      // First re-validate the workspace via server-side invalidation
      await invalidateAll();
      // Then fetch fresh git context for the current workspace
      await refresh();
    } finally {
      retrying = false;
    }
  }

  // Derived status labels
  let statusLabel = $derived.by(() => {
    if (!gitContext) return '';
    if (gitContext.error) return 'Error';
    if (!gitContext.status) return 'Error';
    switch (gitContext.status.headState) {
      case 'clean':
        return 'Clean';
      case 'dirty':
        return 'Dirty';
      case 'detached':
        return 'Detached HEAD';
      case 'unborn':
        return 'No commits yet';
      case 'conflict':
        return 'Conflict';
      default:
        return 'Error';
    }
  });
</script>

<div class="git-context-panel" id="git-context-panel" aria-label="Git context panel">
  {#if !activeWorkspaceId}
    <div class="empty-state" role="status">
      <p>No active workspace</p>
      <span class="empty-hint">Select a workspace from the sidebar to begin.</span>
    </div>
  {:else if gitContext?.error}
    <div class="error-state" role="alert">
      {#if typeof gitContext.error === 'string'}
        <p>{gitContext.error}</p>
      {:else if gitContext.error.errorCode === 'INVALID_WORKSPACE'}
        <p>The workspace path is no longer valid.</p>
      {:else}
        <p>{gitContext.error.message}</p>
      {/if}
      <button
        class="retry-btn"
        onclick={retryContext}
        disabled={retrying}
        aria-label="Retry loading Git context"
      >
        {retrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  {:else if gitContext}
    {#if refreshError && !openSlot}
      <div class="refresh-error" role="alert" aria-label="Refresh error">
        <span class="refresh-error-text">{refreshError}</span>
        <button
          class="retry-btn"
          onclick={retryContext}
          disabled={retrying}
          aria-label="Retry loading Git context"
        >
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    {/if}
    <!-- Status bar -->
    <div class="status-bar" role="status" aria-label="Git status: {statusLabel}">
      <span class="status-indicator status-{gitContext.status?.headState ?? 'error'}"
        >{statusLabel}</span
      >
      {#if gitContext.status}
        <div class="status-counts">
          <span class="count-item" title="Staged files"
            >Staged: {gitContext.status.stagedCount}</span
          >
          <span class="count-item" title="Unstaged files"
            >Unstaged: {gitContext.status.unstagedCount}</span
          >
          <span class="count-item" title="Untracked files"
            >Untracked: {gitContext.status.untrackedCount}</span
          >
          {#if gitContext.status.conflictedCount > 0}
            <span class="count-item conflict" title="Conflicted files"
              >Conflicted: {gitContext.status.conflictedCount}</span
            >
          {/if}
        </div>
      {/if}
      <div class="current-branch">
        {#if gitContext.status?.currentBranch}
          <span class="branch-label">{gitContext.status.currentBranch}</span>
        {:else if gitContext.status?.headState === 'detached'}
          <span class="branch-label detached"
            >HEAD detached at {gitContext.status.detachedCommitHash}</span
          >
        {:else if gitContext.status?.headState === 'unborn'}
          <span class="branch-label">No commits yet</span>
        {/if}
      </div>
    </div>

    <!-- Comparison slots -->
    <div class="comparison-slots" role="group" aria-label="Comparison slots">
      <div class="slot-wrap">
        <button
          bind:this={baseTriggerRef}
          class="slot-btn slot-base"
          class:active={openSlot === 'base'}
          aria-pressed={openSlot === 'base'}
          aria-haspopup="listbox"
          aria-expanded={openSlot === 'base'}
          title={internalDraft?.base.label ?? ''}
          onclick={() => (openSlot = openSlot === 'base' ? null : 'base')}
        >
          <span class="slot-label">Base</span>
          <span class="slot-value">{internalDraft?.base.label ?? '—'}</span>
        </button>
        {#if openSlot === 'base'}
          <BranchSelectPopup
            open
            slotLabel="Base"
            branches={gitContext.branches}
            selectedCanonicalRef={internalDraft?.base.type === 'branch'
              ? internalDraft.base.value
              : null}
            loading={refreshing && gitContext.branches.length === 0}
            error={refreshError}
            triggerRef={baseTriggerRef}
            onSelect={(canonicalRef) => selectBranchByCanonical(canonicalRef, 'base')}
            onRetry={retryContext}
            onClose={() => (openSlot = null)}
          />
        {/if}
      </div>
      <span class="vs-separator">vs</span>
      <div class="slot-wrap">
        <button
          bind:this={targetTriggerRef}
          class="slot-btn slot-target"
          class:active={openSlot === 'target'}
          aria-pressed={openSlot === 'target'}
          aria-haspopup="listbox"
          aria-expanded={openSlot === 'target'}
          title={internalDraft?.target.label ?? ''}
          onclick={() => (openSlot = openSlot === 'target' ? null : 'target')}
        >
          <span class="slot-label">Target</span>
          <span class="slot-value">{internalDraft?.target.label ?? '—'}</span>
        </button>
        {#if openSlot === 'target'}
          <BranchSelectPopup
            open
            slotLabel="Target"
            branches={gitContext.branches}
            selectedCanonicalRef={internalDraft?.target.type === 'branch'
              ? internalDraft.target.value
              : null}
            workingTreeSelected={isWorkingTreeTarget}
            loading={refreshing && gitContext.branches.length === 0}
            error={refreshError}
            triggerRef={targetTriggerRef}
            onSelect={(canonicalRef) => selectBranchByCanonical(canonicalRef, 'target')}
            onSelectWorkingTree={selectWorkingTree}
            onRetry={retryContext}
            onClose={() => (openSlot = null)}
          />
        {/if}
      </div>
    </div>

    <!-- File list -->
    <FileList
      entries={fileListEntries}
      loading={fileListLoading}
      error={fileListError}
      onSelect={onFileSelect}
      {reviewedFilePaths}
      {hasActiveReview}
      onRetry={() => {
        if (internalDraft) fetchFileList(internalDraft);
      }}
    />

    <!-- Commits section -->
    <section class="list-section" aria-label="Commit list">
      <div class="list-header">
        <h3>Commits</h3>
        <input
          class="filter-input"
          type="text"
          placeholder="Filter commits..."
          bind:value={commitFilter}
          aria-label="Filter commits"
        />
      </div>
      <ul class="git-list commits" role="listbox" aria-label="Commit entries">
        {#each filteredCommits() as commit (commit.fullHash)}
          <li>
            <button
              class="git-item commit-item"
              onclick={() => selectCommit(commit.shortHash)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  selectCommit(commit.shortHash);
                }
              }}
            >
              <span class="commit-hash">{commit.shortHash}</span>
              <span class="commit-msg">{commit.message}</span>
            </button>
          </li>
        {:else}
          {#if commitFilter}
            <li class="empty-filter-result">No commits match "{commitFilter}"</li>
          {:else if gitContext.status?.headState === 'unborn'}
            <li class="empty-list">No commits yet</li>
          {:else}
            <li class="empty-list">No commits</li>
          {/if}
        {/each}
      </ul>
    </section>

    <!-- Refresh and last-updated -->
    <div class="panel-footer">
      <button class="refresh-btn" onclick={refresh} aria-label="Refresh Git context">
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
      {#if gitContext.readAt}
        <span class="last-updated" aria-label="Last updated">
          Updated: {new Date(gitContext.readAt).toLocaleTimeString()}
        </span>
      {/if}
    </div>
  {:else}
    <div class="empty-state" role="status">
      <p>Loading Git context...</p>
    </div>
  {/if}
</div>

<style>
  .git-context-panel {
    /* Single scroll owner for the panel content: flex-fill the drawer/panel,
       shrink below content (min-height: 0), and scroll internally. The file
       list inside is content-sized so it never creates a nested scroll. */
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--space-4);
    background: var(--surface-primary);
    overflow-y: auto;
  }

  .empty-state,
  .error-state {
    text-align: center;
    padding: var(--space-8) var(--space-4);
    color: var(--text-secondary);
  }

  .error-state {
    color: var(--color-error);
  }

  .empty-hint {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  /* Status bar */
  .status-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    margin-bottom: var(--space-4);
  }

  .status-indicator {
    font-weight: var(--font-weight-semibold);
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .status-clean {
    background: var(--color-success);
    color: var(--text-inverse);
  }
  .status-dirty {
    background: var(--color-warning);
    color: var(--text-inverse);
  }
  .status-detached {
    background: var(--color-info);
    color: var(--text-inverse);
  }
  .status-unborn {
    background: var(--color-info);
    color: var(--text-inverse);
  }
  .status-conflict {
    background: var(--color-error, #d32f2f);
    color: var(--text-inverse);
  }
  .status-error {
    background: var(--color-error, #d32f2f);
    color: var(--text-inverse);
  }

  .status-counts {
    display: flex;
    gap: var(--space-3);
    margin-left: var(--space-3);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .count-item.conflict {
    color: var(--color-error);
    font-weight: var(--font-weight-semibold);
  }

  .current-branch {
    margin-left: auto;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .branch-label.detached {
    font-style: italic;
  }

  /* Comparison slots */
  .comparison-slots {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-4);
  }

  .slot-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-2) var(--space-3);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    cursor: pointer;
    min-width: 160px;
    width: 100%;
    transition: border-color 0.15s;
  }

  /* Popup anchor: the product branch popup renders inline inside the panel
     (no portal), absolutely positioned below its trigger. The wrap must not
     collapse below the trigger width: the absolute popup inherits the wrap
     width (left:0/right:0), so the wrap keeps a minimum size. */
  .slot-wrap {
    position: relative;
    flex: 1 1 auto;
    min-width: 160px;
  }

  .slot-btn:hover {
    border-color: var(--accent);
  }

  .slot-btn.active {
    border-color: var(--accent);
    background: var(--accent-light, rgba(66, 133, 244, 0.1));
  }

  .slot-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .slot-label {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .slot-value {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .vs-separator {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }

  /* Branch & commit lists */
  .list-section {
    margin-bottom: var(--space-4);
  }

  .list-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .list-header h3 {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .filter-input {
    flex: 1;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    background: var(--surface-secondary);
    color: var(--text-primary);
  }

  .filter-input:focus {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    border-color: var(--accent);
  }

  .git-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    max-height: 200px;
    overflow-y: auto;
  }

  .git-list.commits {
    max-height: 300px;
  }

  .git-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-3);
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .git-item:hover {
    background: var(--surface-hover);
  }

  .git-item:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .git-item.current {
    background: var(--accent-light, rgba(66, 133, 244, 0.08));
    font-weight: var(--font-weight-semibold);
  }

  .item-icon {
    font-size: var(--text-xs);
    width: 16px;
    text-align: center;
  }

  .remote-tag {
    margin-left: auto;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--surface-tertiary);
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }

  .commit-item .commit-hash {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    min-width: 56px;
  }

  .commit-item .commit-msg {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-list,
  .empty-filter-result {
    padding: var(--space-4);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }

  /* Footer */
  .panel-footer {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-subtle);
  }

  .refresh-btn {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .refresh-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .refresh-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .retry-btn {
    margin-top: var(--space-3);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .refresh-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-error, #d32f2f);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--color-error, #d32f2f);
    font-size: var(--text-sm);
  }

  .refresh-error .retry-btn {
    margin-top: 0;
    flex-shrink: 0;
  }

  .refresh-error-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .retry-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .retry-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .retry-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .last-updated {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }
</style>
