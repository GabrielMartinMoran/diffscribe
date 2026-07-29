<script lang="ts">
  import type { FileListEntry } from '$lib/server/application/dto/results/file-list-results';

  let {
    entries = [] as FileListEntry[],
    loading = false,
    error = null as string | null,
    onSelect = undefined as ((path: string) => void) | undefined,
    reviewedFilePaths = [] as string[],
    hasActiveReview = false,
    onRetry = undefined as (() => void) | undefined,
  }: {
    entries: FileListEntry[];
    loading: boolean;
    error: string | null;
    onSelect?: (path: string) => void;
    reviewedFilePaths?: string[];
    hasActiveReview?: boolean;
    onRetry?: () => void;
  } = $props();

  let reviewedSet = $derived(new Set(reviewedFilePaths));

  let pathFilter = $state('');
  let statusFilter = $state('');
  let sortBy = $state<'path' | 'status' | 'additions' | 'deletions'>('path');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let currentPage = $state(1);
  let activeFile = $state<string | null>(null);

  const PAGE_SIZE = 50;

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      added: 'added',
      modified: 'modified',
      deleted: 'deleted',
      renamed: 'renamed',
      copied: 'copied',
      'type-changed': 'type changed',
      unmerged: 'unmerged',
      untracked: 'untracked',
      unknown: 'unknown',
    };
    return map[status] ?? status;
  }

  let filtered = $derived.by(() => {
    let result = entries;

    if (pathFilter) {
      const lower = pathFilter.toLowerCase();
      result = result.filter((e) => e.path.toLowerCase().includes(lower));
    }

    if (statusFilter) {
      result = result.filter((e) => e.status === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'path':
          cmp = a.path.localeCompare(b.path);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'additions':
          cmp = (a.additions ?? 0) - (b.additions ?? 0);
          break;
        case 'deletions':
          cmp = (a.deletions ?? 0) - (b.deletions ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  });

  let totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  let paginated = $derived.by(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  });

  $effect(() => {
    // Reset page when filters change
    if (pathFilter !== '' || statusFilter !== '') {
      currentPage = 1;
    }
  });

  function toggleSort(column: typeof sortBy) {
    if (sortBy === column) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortDir = 'asc';
    }
  }

  function selectFile(filePath: string) {
    activeFile = filePath;
    onSelect?.(filePath);
  }

  function handleRowKeydown(e: KeyboardEvent, idx: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(idx + 1, paginated.length - 1);
      focusRow(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(idx - 1, 0);
      focusRow(prev);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectFile(paginated[idx].path);
    }
  }

  function focusRow(idx: number) {
    const row = document.querySelector(`[data-file-index="${idx}"]`) as HTMLElement | null;
    row?.focus();
  }

  function goPage(step: number) {
    currentPage = Math.max(1, Math.min(totalPages, currentPage + step));
  }

  const ALL_STATUSES = [
    'added',
    'modified',
    'deleted',
    'renamed',
    'copied',
    'type-changed',
    'unmerged',
    'untracked',
    'unknown',
  ];

  function statCell(additions: number | undefined, deletions: number | undefined): string {
    if (additions === undefined || deletions === undefined) return '—';
    return `+${additions} −${deletions}`;
  }

  function sortSymbol(column: typeof sortBy): string {
    if (sortBy === column) {
      return sortDir === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  }
</script>

<div class="file-list-panel" id="file-list-panel" aria-label="File list">
  {#if loading}
    <div class="panel-state loading" role="status">Loading files…</div>
  {:else if error}
    <div class="panel-state error" role="alert">
      <p>{error}</p>
      {#if onRetry}
        <button class="retry-btn" onclick={onRetry} aria-label="Retry loading file list">
          Retry
        </button>
      {/if}
    </div>
  {:else if entries.length === 0}
    <div class="panel-state empty" role="status">
      <p>No changes in working tree</p>
    </div>
  {:else}
    <!-- Filter controls -->
    <div class="controls">
      <input
        class="filter-input"
        type="text"
        placeholder="Filter by path…"
        bind:value={pathFilter}
        aria-label="Filter files by path"
      />
      <select class="filter-select" bind:value={statusFilter} aria-label="Filter by change status">
        <option value="">All statuses</option>
        {#each ALL_STATUSES as status (status)}
          <option value={status}>{statusLabel(status)}</option>
        {/each}
      </select>
    </div>

    <!-- Table header (sortable) -->
    <div class="table-header" role="row">
      <button
        class="header-cell path-col"
        class:sort-active={sortBy === 'path'}
        role="columnheader"
        onclick={() => toggleSort('path')}
        aria-sort={sortBy === 'path' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        File{sortSymbol('path')}
      </button>
      <button
        class="header-cell status-col"
        class:sort-active={sortBy === 'status'}
        role="columnheader"
        onclick={() => toggleSort('status')}
        aria-sort={sortBy === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        Status{sortSymbol('status')}
      </button>
      <button
        class="header-cell stats-col"
        class:sort-active={sortBy === 'additions'}
        role="columnheader"
        onclick={() => toggleSort('additions')}
        aria-sort={sortBy === 'additions'
          ? sortDir === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'}
      >
        ±{sortSymbol('additions')}
      </button>
    </div>

    <!-- File rows -->
    <div class="file-rows" role="listbox" aria-label="Changed files">
      {#each paginated as entry, idx (entry.path)}
        <button
          class="file-row"
          class:active={activeFile === entry.path}
          role="option"
          aria-selected={activeFile === entry.path}
          data-file-index={idx}
          onclick={() => selectFile(entry.path)}
          onkeydown={(e) => handleRowKeydown(e, idx)}
        >
          <div class="path-cell">
            <span class="file-path">{entry.path}</span>
            {#if entry.oldPath && (entry.status === 'renamed' || entry.status === 'copied')}
              <span class="old-path" aria-label="Previously named {entry.oldPath}"
                >{entry.oldPath}</span
              >
            {/if}
          </div>
          <div class="status-cell">
            <span class="status-badge status-{entry.status}">{statusLabel(entry.status)}</span>
            {#if entry.binary}
              <span class="binary-badge" aria-label="Binary file">B</span>
            {/if}
            {#if entry.error}
              <span class="error-badge" title={entry.error}>⚠</span>
            {/if}
          </div>
          <div class="stats-cell">
            {statCell(entry.additions, entry.deletions)}
          </div>
          {#if hasActiveReview}
            <div
              class="review-cell"
              aria-label={reviewedSet.has(entry.path) ? 'Reviewed' : 'Not reviewed'}
            >
              {#if reviewedSet.has(entry.path)}
                <span class="review-marker reviewed" aria-hidden="true">✓</span>
              {:else}
                <span class="review-marker unreviewed" aria-hidden="true">○</span>
              {/if}
            </div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination" aria-label="File list pagination">
        <button disabled={currentPage === 1} onclick={() => goPage(-1)} aria-label="Previous page"
          >←</button
        >
        <span>Page {currentPage} of {totalPages}</span>
        <button
          disabled={currentPage === totalPages}
          onclick={() => goPage(1)}
          aria-label="Next page">→</button
        >
      </div>
    {/if}
  {/if}
</div>

<style>
  .file-list-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--surface-primary);
  }

  .panel-state {
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--text-secondary);
  }

  .panel-state.loading {
    color: var(--text-tertiary);
  }

  .panel-state.error {
    color: var(--state-error-border);
  }

  .retry-btn {
    margin-top: var(--space-2);
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

  .controls {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
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

  .filter-input:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    border-color: var(--accent);
  }

  .filter-select {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    background: var(--surface-secondary);
    color: var(--text-primary);
    min-width: 130px;
  }

  .table-header {
    display: flex;
    border-bottom: 1px solid var(--border-default);
    background: var(--surface-secondary);
    flex-shrink: 0;
  }

  .header-cell {
    padding: var(--space-1) var(--space-3);
    border: none;
    background: none;
    font-size: var(--text-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }

  .header-cell:hover {
    color: var(--text-primary);
  }

  .header-cell.sort-active {
    color: var(--accent);
  }

  .path-col {
    flex: 1;
  }
  .status-col {
    width: 120px;
  }
  .stats-col {
    width: 80px;
    text-align: right;
  }

  .file-rows {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .file-row {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--space-1) var(--space-3);
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    background: none;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: var(--font-family-mono, monospace);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .file-row:hover {
    background: var(--state-hover);
  }

  .file-row:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .file-row.active {
    background: var(--accent-muted);
  }

  .path-cell {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .file-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .old-path {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-cell {
    width: 120px;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .status-badge {
    display: inline-block;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-medium);
    font-family: inherit;
    line-height: 1.4;
    white-space: nowrap;
  }

  .status-added {
    background: var(--diff-added-bg);
    color: var(--diff-added-text);
  }
  .status-modified {
    background: var(--diff-modified-bg);
    color: var(--diff-modified-text);
  }
  .status-deleted {
    background: var(--diff-removed-bg);
    color: var(--diff-removed-text);
  }
  .status-renamed {
    background: var(--accent-muted);
    color: var(--accent);
  }
  .status-copied {
    background: var(--accent-muted);
    color: var(--accent);
  }
  .status-type-changed {
    background: var(--diff-modified-bg);
    color: var(--diff-modified-text);
  }
  .status-unmerged {
    background: var(--state-error-bg);
    color: var(--severity-critical);
  }
  .status-untracked {
    background: var(--diff-modified-bg);
    color: var(--text-secondary);
  }
  .status-unknown {
    background: var(--state-disabled-bg);
    color: var(--state-disabled-text);
  }

  .binary-badge {
    display: inline-block;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    background: var(--text-tertiary);
    color: var(--text-inverse);
    line-height: 1.4;
  }

  .error-badge {
    font-size: var(--text-xs);
    cursor: help;
  }

  .stats-cell {
    width: 80px;
    text-align: right;
    font-size: var(--text-xs);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .review-cell {
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .review-marker {
    font-size: var(--text-sm);
    line-height: 1;
  }

  .review-marker.reviewed {
    color: var(--diff-added-fg, #1b5e20);
    font-weight: var(--font-weight-bold);
  }

  .review-marker.unreviewed {
    color: var(--text-tertiary);
    opacity: 0.5;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--border-subtle);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .pagination button {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--text-xs);
  }

  .pagination button:hover:not(:disabled) {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .pagination button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
