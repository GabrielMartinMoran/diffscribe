<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags */
  import { File, FileText, Info, LoaderCircle } from 'svelte-lucide';

  import { readStoredWrap, resolveWrap } from '$lib/web/stores/wrap-store';
  import type { ComparisonDraft } from '$lib/web/types/comparison-draft';
  import { createRequestGuard } from '$lib/web/utils/request-guard';

  // Client-side mirror of server FileSourceResult types
  type SourceChangeType = 'added' | 'removed' | 'modified' | 'unchanged' | null;

  interface SourceLine {
    lineNumber: number;
    content: string;
    changeType: SourceChangeType;
    html?: string;
    text?: string;
  }

  interface SourceResult {
    path: string;
    language: string;
    lines: SourceLine[];
    isBinary: boolean;
    isTruncated: boolean;
    truncationReason?: string;
    isDeleted: boolean;
    readAt: string;
    error?: { message: string; errorCode: string };
  }

  let {
    filePath = null as string | null,
    activeWorkspaceId = null as string | null,
    comparisonDraft = null as ComparisonDraft | null,
  }: {
    filePath: string | null;
    activeWorkspaceId: string | null;
    comparisonDraft: ComparisonDraft | null;
  } = $props();

  let sourceResult = $state<SourceResult | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let wrapLines = $state(false);
  // Monotonic guard: stale responses must not overwrite newer file content
  // when the user switches tabs/files quickly.
  const requestGuard = createRequestGuard();

  // Per-file wrap state: start from the global Settings default whenever a
  // different file opens; the contextual toggle overrides it for this file
  // only (not persisted).
  $effect(() => {
    if (!filePath) return;
    wrapLines = resolveWrap(readStoredWrap(window.localStorage));
  });

  function toggleWrap() {
    wrapLines = !wrapLines;
  }

  // Fetch source when file path changes
  $effect(() => {
    if (filePath && activeWorkspaceId && comparisonDraft) {
      fetchSource();
    } else if (!filePath) {
      sourceResult = null;
      error = null;
    }
  });

  async function fetchSource(): Promise<void> {
    if (!filePath || !activeWorkspaceId || !comparisonDraft) return;
    const generation = requestGuard.begin();
    loading = true;
    error = null;
    sourceResult = null;

    try {
      const comparisonParam = encodeURIComponent(JSON.stringify(comparisonDraft));
      const pathParam = encodeURIComponent(filePath);
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/source?comparison=${comparisonParam}&path=${pathParam}`,
      );
      const data: SourceResult = await res.json();

      if (!requestGuard.isCurrent(generation)) return;
      if (data.error) {
        error = data.error.message;
        sourceResult = null;
      } else {
        sourceResult = data;
      }
    } catch (e: unknown) {
      if (!requestGuard.isCurrent(generation)) return;
      error = e instanceof Error ? e.message : 'Failed to load source';
      sourceResult = null;
    } finally {
      if (requestGuard.isCurrent(generation)) {
        loading = false;
      }
    }
  }

  /** CSS class for the change type gutter marker. */
  function markerClass(changeType: SourceChangeType): string {
    switch (changeType) {
      case 'added':
        return 'marker-added';
      case 'removed':
        return 'marker-removed';
      case 'modified':
        return 'marker-modified';
      default:
        return 'marker-unchanged';
    }
  }

  /** Human-readable label for the change marker. */
  function markerLabel(changeType: SourceChangeType): string {
    switch (changeType) {
      case 'added':
        return 'Added';
      case 'removed':
        return 'Removed';
      case 'modified':
        return 'Modified';
      default:
        return '';
    }
  }

  function handleRetry(): void {
    fetchSource();
  }
</script>

<div class="source-viewer" data-testid="source-viewer" role="region" aria-label="Source viewer">
  {#if !filePath}
    <!-- No file selected -->
    <div class="viewer-state" role="status">
      <File size="24" ariaLabel="File" />
      <p>No file selected.</p>
      <span class="state-hint">Select a file from the Project tree to view its source.</span>
    </div>
  {:else if loading}
    <!-- Loading -->
    <div class="viewer-state" role="status" aria-label="Loading source">
      <LoaderCircle class="spin-icon" size="24" ariaLabel="Loading" />
      <p>Loading source…</p>
    </div>
  {:else if error}
    <!-- Error -->
    <div class="viewer-state viewer-error" role="alert">
      <Info size="24" ariaLabel="Error" />
      <p>Failed to load source.</p>
      <span class="error-detail">{error}</span>
      <button class="retry-btn" onclick={handleRetry} aria-label="Retry loading source">
        Retry
      </button>
    </div>
  {:else if sourceResult?.isDeleted}
    <!-- Deleted file -->
    <div class="viewer-state viewer-deleted" role="status">
      <Info size="24" ariaLabel="Deleted" />
      <p>This file has been deleted.</p>
      <span class="state-hint">No content to display.</span>
    </div>
  {:else if sourceResult?.isBinary}
    <!-- Binary file -->
    <div class="viewer-state viewer-binary" role="status">
      <FileText size="24" ariaLabel="Binary file" />
      <p>Binary file</p>
      <span class="state-hint">
        {sourceResult?.truncationReason ?? 'This file is binary and cannot be displayed.'}
      </span>
    </div>
  {:else if sourceResult?.isTruncated}
    <!-- Truncated file -->
    <div class="viewer-state viewer-truncated" role="status">
      <Info size="24" ariaLabel="Truncated" />
      <p>File too large to display</p>
      <span class="state-hint">
        {sourceResult?.truncationReason ?? 'This file exceeds the maximum display size.'}
      </span>
    </div>
  {:else if sourceResult && sourceResult.lines.length === 0}
    <!-- Empty file -->
    <div class="viewer-state" role="status">
      <FileText size="24" ariaLabel="Empty file" />
      <p>Empty file</p>
      <span class="state-hint">This file has no content.</span>
    </div>
  {:else if sourceResult}
    <!-- Source content -->
    <div class="source-header" data-testid="source-file-path">
      <File size="14" class="header-icon" ariaLabel="File" />
      <span class="header-path">{sourceResult.path}</span>
      <span class="header-lang">{sourceResult.language}</span>
      <button
        class="wrap-btn"
        onclick={toggleWrap}
        aria-pressed={wrapLines}
        aria-label={wrapLines ? 'Disable line wrapping' : 'Enable line wrapping'}
      >
        Wrap
      </button>
    </div>

    <div
      class="source-lines"
      class:wrap-enabled={wrapLines}
      data-testid="source-content"
      role="list"
      aria-label="Source lines"
    >
      {#each sourceResult.lines as line (line.lineNumber)}
        <div
          class="source-line"
          class:added={line.changeType === 'added'}
          class:removed={line.changeType === 'removed'}
          class:modified={line.changeType === 'modified'}
          role="listitem"
        >
          <!-- Line number -->
          <span class="line-number" data-testid="line-number">{line.lineNumber}</span>

          <!-- Change marker -->
          {#if line.changeType && line.changeType !== 'unchanged'}
            <span
              class="change-marker {markerClass(line.changeType)}"
              data-testid="change-marker"
              aria-label={markerLabel(line.changeType)}
            ></span>
          {:else}
            <span class="change-marker marker-none"></span>
          {/if}

          <!-- Line content: syntax-highlighted HTML or plain text -->
          <span class="line-content" data-testid="line-content">
            {#if line.html}
              {@html line.html}
            {:else}
              <code>{line.text ?? line.content}</code>
            {/if}
          </span>
        </div>
      {/each}

      {#if sourceResult.isTruncated}
        <div class="truncation-notice" role="status">
          <Info size="14" ariaLabel="Info" />
          <span>{sourceResult.truncationReason ?? 'File truncated'}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .source-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--surface-primary);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  /* ── State views ── */
  .viewer-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: var(--space-2);
    padding: var(--space-8) var(--space-4);
    color: var(--text-secondary);
    text-align: center;
  }

  .viewer-state p {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-weight-semibold, 600);
  }

  .state-hint {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .viewer-error {
    color: var(--text-error);
  }

  .error-detail {
    font-size: var(--text-sm);
    max-width: 400px;
    word-break: break-word;
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
    background: var(--surface-hover);
  }

  .retry-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  /* ── Header ── */
  .source-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: var(--font-sans);
    flex-shrink: 0;
  }

  .header-icon {
    flex-shrink: 0;
    color: var(--text-tertiary);
  }

  .header-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-medium, 500);
  }

  .header-lang {
    flex-shrink: 0;
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    text-transform: uppercase;
  }

  .wrap-btn {
    flex-shrink: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
    cursor: pointer;
  }

  .wrap-btn:hover {
    background: var(--surface-hover);
  }

  .wrap-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .wrap-btn[aria-pressed='true'] {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  /* ── Lines ── */
  .source-lines {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
  }

  /* Wrap mode: long lines wrap inside the viewer. `pre-wrap` keeps code
     whitespace; overflow-wrap/word-break utilities are intentionally not
     used (see docs/design.md — Base UI kit anti-patterns). The viewer owns
     the single horizontal scroll container for the file. */
  .source-lines.wrap-enabled .line-content {
    white-space: pre-wrap;
  }

  .source-line {
    display: flex;
    align-items: stretch;
    min-height: 20px;
  }

  .source-line:hover {
    background: var(--surface-hover);
  }

  .source-line.added {
    background: var(--source-line-added-bg);
  }

  .source-line.removed {
    background: var(--source-line-removed-bg);
  }

  .source-line.modified {
    background: var(--source-line-modified-bg);
  }

  /* ── Line number ── */
  .line-number {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 48px;
    min-width: 48px;
    /* 48 px is the outer cell width: the 1 px divider and the internal
       padding are included via border-box, keeping the divider inside the
       total width. */
    box-sizing: border-box;
    padding: 0 var(--space-2);
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    user-select: none;
    border-right: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
  }

  /* ── Change marker ── */
  .change-marker {
    display: flex;
    align-items: center;
    width: 4px;
    min-width: 4px;
    flex-shrink: 0;
  }

  .marker-added {
    background: var(--source-marker-added);
  }

  .marker-removed {
    background: var(--source-marker-removed);
  }

  .marker-modified {
    background: var(--source-marker-modified);
  }

  .marker-none {
    background: transparent;
  }

  /* ── Line content ── */
  .line-content {
    flex: 1;
    padding: 0 var(--space-3);
    white-space: pre;
    overflow: hidden;
    color: var(--text-primary);
  }

  .line-content code {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: none;
  }

  :global(.source-line .line-content :where(.shiki, .highlighted)) {
    background: none !important;
  }

  /* ── Truncation notice ── */
  .truncation-notice {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-warning);
    color: var(--text-warning);
    font-size: var(--text-sm);
    font-family: var(--font-sans);
  }

  .spin-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spin-icon {
      animation: none;
    }
  }
</style>
