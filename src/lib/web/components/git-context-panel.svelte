<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type {
    FileListEntry,
    FileListResult,
  } from '$lib/server/application/dto/results/file-list-results';
  import type { GitContextAggregate } from '$lib/server/application/services/get-git-context-use-case';
  import FileList from '$lib/web/components/file-list.svelte';

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
    onFileSelect = undefined as ((path: string) => void) | undefined,
    onComparisonChange = undefined as ((draft: ComparisonDraft) => void) | undefined,
    reviewedFilePaths = [] as string[],
    hasActiveReview = false,
  }: {
    gitContext: GitContextAggregate | null;
    activeWorkspaceId: string | null;
    comparisonDraft?: ComparisonDraft | null;
    onFileSelect?: (path: string) => void;
    onComparisonChange?: (draft: ComparisonDraft) => void;
    reviewedFilePaths?: string[];
    hasActiveReview?: boolean;
  } = $props();

  let branchFilter = $state('');
  let commitFilter = $state('');
  let activeSlot = $state<'base' | 'target' | null>(null);
  let refreshing = $state(false);
  let retrying = $state(false);

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
    fileListLoading = true;
    fileListError = null;
    try {
      const comparisonParam = encodeURIComponent(JSON.stringify(draft));
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/file-list?comparison=${comparisonParam}`,
      );
      const data: FileListResult = await res.json();
      if (data.error) {
        fileListError = data.error.message;
        fileListEntries = [];
      } else {
        fileListEntries = data.entries;
      }
    } catch (e: unknown) {
      fileListError = e instanceof Error ? e.message : 'Failed to load file list';
      fileListEntries = [];
    } finally {
      fileListLoading = false;
    }
  }

  function filteredBranches() {
    if (!gitContext?.branches) return [];
    const filter = branchFilter.toLowerCase();
    return gitContext.branches.filter((b) => b.name.toLowerCase().includes(filter));
  }

  function filteredCommits() {
    if (!gitContext?.commits) return [];
    const filter = commitFilter.toLowerCase();
    return gitContext.commits.filter(
      (c) => c.message.toLowerCase().includes(filter) || c.shortHash.toLowerCase().includes(filter),
    );
  }

  function selectBranch(name: string) {
    if (!activeSlot || !internalDraft) return;
    const updated = { ...internalDraft };
    if (activeSlot === 'base') {
      updated.base = { type: 'branch' as const, value: name, label: name };
    } else {
      updated.target = { type: 'branch' as const, value: name, label: name };
    }
    updated.comparisonType = 'branch-vs-branch';
    internalDraft = updated;
  }

  function selectCommit(shortHash: string) {
    if (!activeSlot || !internalDraft) return;
    const updated = { ...internalDraft };
    if (activeSlot === 'base') {
      updated.base = { type: 'commit' as const, value: shortHash, label: shortHash };
    } else {
      updated.target = { type: 'commit' as const, value: shortHash, label: shortHash };
    }
    updated.comparisonType = 'commit-vs-commit';
    internalDraft = updated;
  }

  async function refresh() {
    if (!activeWorkspaceId) return;
    refreshing = true;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git-context`);
      const data = await res.json();
      gitContext = data;
    } finally {
      refreshing = false;
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
      <button
        class="slot-btn"
        class:active={activeSlot === 'base'}
        aria-pressed={activeSlot === 'base'}
        onclick={() => (activeSlot = activeSlot === 'base' ? null : 'base')}
      >
        <span class="slot-label">Base</span>
        <span class="slot-value">{internalDraft?.base.label ?? '—'}</span>
      </button>
      <span class="vs-separator">vs</span>
      <button
        class="slot-btn"
        class:active={activeSlot === 'target'}
        aria-pressed={activeSlot === 'target'}
        onclick={() => (activeSlot = activeSlot === 'target' ? null : 'target')}
      >
        <span class="slot-label">Target</span>
        <span class="slot-value">{internalDraft?.target.label ?? '—'}</span>
      </button>
      <span class="comparison-type">{internalDraft?.comparisonType ?? ''}</span>
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

    <!-- Branches section -->
    <section class="list-section" aria-label="Branch list">
      <div class="list-header">
        <h3>Branches</h3>
        <input
          class="filter-input"
          type="text"
          placeholder="Filter branches..."
          bind:value={branchFilter}
          aria-label="Filter branches"
        />
      </div>
      <ul class="git-list" role="listbox" aria-label="Local branches">
        {#each filteredBranches() as branch (branch.name)}
          <li>
            <button
              class="git-item"
              class:current={branch.isCurrent}
              role="option"
              aria-selected={branch.isCurrent}
              onclick={() => selectBranch(branch.name)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  selectBranch(branch.name);
                }
              }}
            >
              <span class="item-icon">{branch.isCurrent ? '●' : '○'}</span>
              <span class="item-name">{branch.name}</span>
            </button>
          </li>
        {:else}
          {#if branchFilter}
            <li class="empty-filter-result">No branches match "{branchFilter}"</li>
          {:else if gitContext.status?.headState === 'unborn'}
            <li class="empty-list">No branches yet</li>
          {:else}
            <li class="empty-list">No branches</li>
          {/if}
        {/each}
      </ul>
    </section>

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
      <ul class="git-list commits">
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
      <button
        class="refresh-btn"
        onclick={refresh}
        disabled={refreshing}
        aria-label="Refresh Git context"
      >
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
    color: var(--color-error, #d32f2f);
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
    background: var(--color-success, #2e7d32);
    color: #fff;
  }
  .status-dirty {
    background: var(--color-warning, #f9a825);
    color: #000;
  }
  .status-detached {
    background: var(--color-info, #1565c0);
    color: #fff;
  }
  .status-unborn {
    background: var(--color-info, #1565c0);
    color: #fff;
  }
  .status-conflict {
    background: var(--color-error, #d32f2f);
    color: #fff;
  }
  .status-error {
    background: var(--color-error, #d32f2f);
    color: #fff;
  }

  .status-counts {
    display: flex;
    gap: var(--space-3);
    margin-left: var(--space-3);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .count-item.conflict {
    color: var(--color-error, #d32f2f);
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
    min-width: 100px;
    transition: border-color 0.15s;
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
    max-width: 120px;
  }

  .vs-separator {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }

  .comparison-type {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    margin-left: auto;
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

  .commit-item .commit-hash {
    font-family: var(--font-mono, monospace);
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
