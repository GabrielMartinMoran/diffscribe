<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import type {
    ReviewListItem,
    ReviewResult,
  } from '$lib/server/application/dto/results/review-results';

  interface ComparisonDraft {
    base: { type: string; value: string; label: string };
    target: { type: string; value: string; label: string };
    comparisonType: string;
    createdAt: string;
  }

  let {
    activeWorkspaceId = null as string | null,
    activeReview = null as ReviewResult | null,
    comparisonDraft = null as ComparisonDraft | null,
    selectedFile = null as string | null,
    fileListEntries = [] as Array<{ path: string }>,
    reviewedFilePaths = [] as string[],
    onReviewChange = undefined as (() => void) | undefined,
    onMarkChange = undefined as ((filePath: string, marked: boolean) => void) | undefined,
  }: {
    activeWorkspaceId: string | null;
    activeReview: ReviewResult | null;
    comparisonDraft: ComparisonDraft | null;
    selectedFile: string | null;
    fileListEntries: Array<{ path: string }>;
    reviewedFilePaths?: string[];
    onReviewChange?: () => void;
    onMarkChange?: (filePath: string, marked: boolean) => void;
  } = $props();

  let creating = $state(false);
  let completing = $state(false);
  let marking = $state(false);
  let unmarking = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let reviewList = $state<ReviewListItem[]>([]);
  let showReviewList = $state(false);
  let showCompleteConfirm = $state(false);

  // Local reactive mark set — syncs from prop, updated optimistically
  let localMarks = new SvelteSet<string>([]);

  $effect(() => {
    // Sync local marks with prop when activeReview or reviewedFilePaths changes
    if (activeReview) {
      localMarks = new SvelteSet(reviewedFilePaths);
    } else {
      localMarks = new SvelteSet();
    }
  });

  let isMarked = $derived(selectedFile ? localMarks.has(selectedFile) : false);
  let reviewedCount = $derived(localMarks.size);
  let totalCount = $derived(fileListEntries.length);
  let progressPercent = $derived(totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0);

  async function createReview() {
    if (!activeWorkspaceId || !comparisonDraft) return;
    creating = true;
    error = null;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparison: comparisonDraft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' }));
        error = body.error || `Failed (${res.status})`;
      } else {
        onReviewChange?.();
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to create review';
    } finally {
      creating = false;
    }
  }

  async function completeReview() {
    if (!activeWorkspaceId || !activeReview) return;
    completing = true;
    error = null;
    showCompleteConfirm = false;
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${activeReview.id}/complete`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' }));
        error = body.error || `Failed (${res.status})`;
      } else {
        onReviewChange?.();
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to complete review';
    } finally {
      completing = false;
    }
  }

  async function markSelectedFile() {
    if (!activeWorkspaceId || !activeReview || !selectedFile) return;
    marking = true;
    error = null;
    // Optimistic update
    localMarks = new SvelteSet(localMarks).add(selectedFile);
    onMarkChange?.(selectedFile, true);
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${activeReview.id}/mark-file`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: selectedFile }),
        },
      );
      if (!res.ok) {
        // Revert on failure
        const newMarks = new SvelteSet(localMarks);
        newMarks.delete(selectedFile);
        localMarks = newMarks;
        onMarkChange?.(selectedFile, false);
        const body = await res.json().catch(() => ({ error: 'Failed' }));
        error = body.error || `Failed (${res.status})`;
      }
    } catch (e: unknown) {
      const newMarks = new SvelteSet(localMarks);
      newMarks.delete(selectedFile);
      localMarks = newMarks;
      onMarkChange?.(selectedFile, false);
      error = e instanceof Error ? e.message : 'Failed to mark file';
    } finally {
      marking = false;
    }
  }

  async function unmarkSelectedFile() {
    if (!activeWorkspaceId || !activeReview || !selectedFile) return;
    unmarking = true;
    error = null;
    // Optimistic update
    const newMarks = new SvelteSet(localMarks);
    newMarks.delete(selectedFile);
    localMarks = newMarks;
    onMarkChange?.(selectedFile, false);
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${activeReview.id}/unmark-file`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: selectedFile }),
        },
      );
      if (!res.ok) {
        // Revert on failure
        localMarks = new SvelteSet(localMarks).add(selectedFile);
        onMarkChange?.(selectedFile, true);
        const body = await res.json().catch(() => ({ error: 'Failed' }));
        error = body.error || `Failed (${res.status})`;
      }
    } catch (e: unknown) {
      localMarks = new SvelteSet(localMarks).add(selectedFile);
      onMarkChange?.(selectedFile, true);
      error = e instanceof Error ? e.message : 'Failed to unmark file';
    } finally {
      unmarking = false;
    }
  }

  async function loadReviewList() {
    if (!activeWorkspaceId) return;
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/reviews`);
      const data = await res.json();
      reviewList = data.reviews || [];
    } catch {
      reviewList = [];
    } finally {
      loading = false;
    }
  }

  async function reopenReview(reviewId: string) {
    if (!activeWorkspaceId) return;
    error = null;
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${reviewId}/set-active`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' }));
        error = body.error || `Failed (${res.status})`;
      } else {
        showReviewList = false;
        onReviewChange?.();
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to reopen review';
    }
  }

  function isReviewSelected(reviewId: string): boolean {
    return activeReview ? reviewId === activeReview.id : false;
  }

  $effect(() => {
    if (showReviewList && activeWorkspaceId) {
      loadReviewList();
    }
  });
</script>

<div class="review-panel" id="review-panel" aria-label="Review panel">
  {#if error}
    <div class="review-error" role="alert">
      <p>{error}</p>
      <button class="retry-btn" onclick={() => (error = null)} aria-label="Dismiss error">
        Dismiss
      </button>
    </div>
  {/if}

  {#if activeReview}
    <div class="review-active">
      <div class="review-header">
        <span class="review-title">
          {activeReview.title || 'Untitled Review'}
        </span>
        <span
          class="review-status status-{activeReview.status}"
          aria-label={`Status: ${activeReview.status}`}
        >
          {activeReview.status}
        </span>
      </div>

      <div class="review-progress" aria-label={`Progress: ${reviewedCount} of ${totalCount}`}>
        <progress
          class="progress-bar"
          value={progressPercent}
          max="100"
          aria-label="Review progress bar"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin="0"
          aria-valuemax="100"
        ></progress>
        <span class="progress-text">{reviewedCount}/{totalCount} files reviewed</span>
      </div>

      {#if activeReview.status !== 'completed'}
        <div class="review-actions">
          {#if selectedFile}
            {#if isMarked}
              <button
                class="action-btn unmark-btn"
                onclick={unmarkSelectedFile}
                disabled={unmarking || creating || completing}
                aria-label="Unmark {selectedFile}"
              >
                {unmarking ? 'Unmarking…' : 'Unmark'}
              </button>
            {:else}
              <button
                class="action-btn mark-btn"
                onclick={markSelectedFile}
                disabled={marking || creating || completing}
                aria-label="Mark {selectedFile} as reviewed"
              >
                {marking ? 'Marking…' : 'Mark as Reviewed'}
              </button>
            {/if}
          {:else}
            <span class="action-hint">Select a file to mark it as reviewed</span>
          {/if}

          <button
            class="action-btn complete-btn"
            onclick={() => (showCompleteConfirm = true)}
            disabled={completing || marking || unmarking}
            aria-label="Complete review"
          >
            {completing ? 'Completing…' : 'Complete Review'}
          </button>
        </div>
      {/if}

      {#if activeReview.status === 'completed'}
        <div class="review-readonly" role="status">This review is completed and read-only.</div>
      {/if}
    </div>

    {#if showCompleteConfirm}
      <div
        class="confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Complete review confirmation"
      >
        <div class="confirm-dialog">
          <p>Complete this review? It will become read-only.</p>
          <div class="confirm-actions">
            <button class="action-btn confirm-yes" onclick={completeReview} disabled={completing}>
              Yes, Complete
            </button>
            <button class="action-btn confirm-no" onclick={() => (showCompleteConfirm = false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="review-inactive">
      <p class="review-placeholder">No active review</p>

      <button
        class="action-btn new-btn"
        onclick={createReview}
        disabled={creating || !comparisonDraft || !activeWorkspaceId}
        aria-label="Start a new review from current comparison"
      >
        {creating ? 'Creating…' : 'New Review'}
      </button>

      <button
        class="action-btn list-btn"
        onclick={() => {
          showReviewList = !showReviewList;
          if (showReviewList) loadReviewList();
        }}
        aria-expanded={showReviewList}
        aria-label={showReviewList ? 'Hide review list' : 'Show review list'}
      >
        {showReviewList ? 'Hide List' : 'View Reviews'}
      </button>
    </div>

    {#if showReviewList}
      <div class="review-list-container" role="listbox" aria-label="Review list">
        {#if loading}
          <div class="list-state">Loading reviews…</div>
        {:else if reviewList.length === 0}
          <div class="list-state">No reviews yet</div>
        {:else}
          {#each reviewList as review (review.id)}
            <button
              class="review-list-item"
              role="option"
              aria-selected={isReviewSelected(review.id)}
              onclick={() => reopenReview(review.id)}
            >
              <span class="list-item-title">{review.title || 'Untitled'}</span>
              <span class="list-item-status status-{review.status}">{review.status}</span>
              <span class="list-item-progress">{review.reviewedCount}/{review.totalCount}</span>
              <span class="list-item-date">
                {review.completedAt
                  ? `Completed ${new Date(review.completedAt).toLocaleDateString()}`
                  : `Created ${new Date(review.createdAt).toLocaleDateString()}`}
              </span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .review-panel {
    padding: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
  }

  .review-error {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    margin-bottom: var(--space-2);
    background: var(--state-error-bg, #ffebee);
    border: 1px solid var(--state-error-border, #ef5350);
    border-radius: var(--radius-sm);
    color: var(--text-error, #c62828);
    font-size: var(--text-sm);
  }

  .retry-btn {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--text-xs);
    white-space: nowrap;
  }

  .retry-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
  }

  .review-active {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .review-title {
    font-weight: var(--font-weight-semibold);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .review-status {
    font-size: var(--text-xs);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    font-weight: var(--font-weight-medium);
    text-transform: capitalize;
  }
  .status-draft {
    background: var(--accent-muted);
    color: var(--accent);
  }
  .status-completed {
    background: var(--diff-added-bg, rgba(0, 200, 0, 0.1));
    color: var(--diff-added-fg, #1b5e20);
  }

  .review-progress {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--surface-tertiary);
  }
  .progress-bar::-webkit-progress-value {
    background: var(--accent);
    border-radius: var(--radius-sm);
  }
  .progress-bar::-moz-progress-bar {
    background: var(--accent);
    border-radius: var(--radius-sm);
  }

  .progress-text {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    white-space: nowrap;
    font-family: var(--font-mono, monospace);
  }

  .review-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
  }

  .action-hint {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .action-btn {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .action-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }
  .action-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 1px;
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }
  }

  .mark-btn {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }
  .mark-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .unmark-btn {
    background: var(--surface-tertiary);
    border-color: var(--text-secondary);
  }
  .unmark-btn:hover:not(:disabled) {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }

  .complete-btn {
    background: var(--diff-added-bg, rgba(0, 200, 0, 0.05));
    border-color: var(--diff-added-fg, #1b5e20);
    color: var(--diff-added-fg, #1b5e20);
  }

  .new-btn {
    width: 100%;
    text-align: center;
    padding: var(--space-2);
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
    font-weight: var(--font-weight-medium);
  }

  .list-btn {
    width: 100%;
    text-align: center;
    margin-top: var(--space-1);
  }

  .review-inactive {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .review-placeholder {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-align: center;
    margin: 0;
    padding: var(--space-1) 0;
  }

  .review-readonly {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    font-style: italic;
    text-align: center;
    padding: var(--space-1);
  }

  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .confirm-dialog {
    background: var(--surface-primary);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl, 0 4px 24px rgba(0, 0, 0, 0.15));
    max-width: 320px;
    text-align: center;
  }
  .confirm-dialog p {
    font-size: var(--text-sm);
    color: var(--text-primary);
    margin: 0 0 var(--space-3) 0;
  }
  .confirm-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }
  .confirm-yes {
    background: var(--diff-added-fg, #1b5e20);
    color: white;
    border-color: var(--diff-added-fg, #1b5e20);
  }
  .confirm-yes:hover:not(:disabled) {
    opacity: 0.9;
  }
  .confirm-no {
    background: var(--surface-secondary);
  }

  .review-list-container {
    margin-top: var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    max-height: 240px;
    overflow-y: auto;
  }

  .list-state {
    padding: var(--space-3);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }

  .review-list-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-3);
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    background: none;
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .review-list-item:last-child {
    border-bottom: none;
  }
  .review-list-item:hover {
    background: var(--surface-hover);
  }
  .review-list-item:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .list-item-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list-item-status {
    font-size: var(--text-xs);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
  }
  .list-item-progress {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-family: var(--font-mono, monospace);
  }
  .list-item-date {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    white-space: nowrap;
  }
</style>
