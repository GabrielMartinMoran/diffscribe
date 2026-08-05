<script lang="ts">
  import type {
    CompleteDiffFile,
    CompleteDiffResult,
  } from '$lib/server/application/dto/results/complete-diff-results';
  import { createRequestGuard } from '$lib/web/utils/request-guard';

  interface ComparisonDraft {
    base: { type: string; value: string; label: string };
    target: { type: string; value: string; label: string };
    comparisonType: string;
    createdAt: string;
  }

  let {
    activeWorkspaceId = null as string | null,
    comparisonDraft = null as ComparisonDraft | null,
    scrollTarget = null as string | null,
    onScrollHandled = undefined as (() => void) | undefined,
    onFileClick = undefined as ((path: string, newTab?: boolean) => void) | undefined,
  }: {
    activeWorkspaceId: string | null;
    comparisonDraft: ComparisonDraft | null;
    scrollTarget?: string | null;
    onScrollHandled?: () => void;
    onFileClick?: (path: string, newTab?: boolean) => void;
  } = $props();

  let result = $state<CompleteDiffResult | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  // Monotonic guard: stale responses must not overwrite newer content when
  // the comparison changes quickly.
  const requestGuard = createRequestGuard();
  let lastScrollTarget = $state<string | null>(null);

  $effect(() => {
    if (activeWorkspaceId && comparisonDraft) {
      void fetchCompleteDiff();
    } else {
      result = null;
      error = null;
    }
  });

  async function fetchCompleteDiff(): Promise<void> {
    if (!activeWorkspaceId || !comparisonDraft) return;
    const generation = requestGuard.begin();
    loading = true;
    error = null;
    try {
      const comparisonParam = encodeURIComponent(JSON.stringify(comparisonDraft));
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/complete-diff?comparison=${comparisonParam}`,
      );
      if (!requestGuard.isCurrent(generation)) return;
      if (!res.ok) {
        error = `Failed to load complete diff (${res.status})`;
        return;
      }
      const data: CompleteDiffResult = await res.json();
      if (!requestGuard.isCurrent(generation)) return;
      result = data;
    } catch {
      if (requestGuard.isCurrent(generation)) {
        error = 'Failed to load complete diff';
      }
    } finally {
      if (requestGuard.isCurrent(generation)) {
        loading = false;
      }
    }
  }

  // Scroll the requested file section into view (with the sticky index
  // offset) and acknowledge the scroll so the shell can clear the target.
  $effect(() => {
    if (!scrollTarget || scrollTarget === lastScrollTarget) return;
    lastScrollTarget = scrollTarget;
    const element = document.querySelector(
      `[data-testid="file-diff-section-${cssEscape(scrollTarget)}"]`,
    );
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    onScrollHandled?.();
  });

  function cssEscape(value: string): string {
    return value.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  function handleIndexClick(file: CompleteDiffFile, event: MouseEvent): void {
    onFileClick?.(file.path, event.ctrlKey || event.metaKey);
  }
</script>

<div data-testid="complete-diff-viewer" class="complete-diff-viewer">
  {#if loading}
    <div class="complete-diff-state" role="status">Loading complete diff…</div>
  {:else if error}
    <div class="complete-diff-state complete-diff-error" role="alert">
      <p>{error}</p>
      <button
        class="retry-btn"
        onclick={fetchCompleteDiff}
        aria-label="Retry loading complete diff"
      >
        Retry
      </button>
    </div>
  {:else if result}
    <div class="complete-diff-inner">
      {#if result.isTruncated}
        <div class="truncation-notice" role="alert" data-testid="complete-diff-truncation-notice">
          {result.truncationReason ?? 'Complete diff truncated'}
        </div>
      {/if}

      {#if result.files.length === 0}
        <div class="complete-diff-state" role="status">
          <p>No changes in this comparison</p>
        </div>
      {:else}
        <!-- File index -->
        <div
          class="complete-diff-index"
          data-testid="complete-diff-index"
          role="list"
          aria-label="Changed files"
        >
          {#each result.files as file (file.path)}
            <div class="index-entry" role="listitem">
              <button
                class="index-entry-button"
                type="button"
                title={file.path}
                onclick={(e) => handleIndexClick(file, e)}
              >
                <span class="index-status" aria-hidden="true">{file.status}</span>
                <span class="index-path">{file.path}</span>
                {#if file.binary}
                  <span class="index-marker" aria-label="Binary file">B</span>
                {/if}
                {#if file.isTruncated}
                  <span class="index-marker" aria-label="Truncated">…</span>
                {/if}
              </button>
            </div>
          {/each}
        </div>

        <!-- File sections -->
        <div class="complete-diff-sections" data-testid="complete-diff-scroll">
          {#each result.files as file (file.path)}
            <section
              class="file-diff-section"
              data-testid="file-diff-section-{cssEscape(file.path)}"
              aria-label={file.path}
            >
              <header class="file-diff-header">
                <h3 class="file-diff-path">{file.path}</h3>
                {#if file.oldPath}
                  <span class="file-diff-old-path" aria-label="Previously named {file.oldPath}"
                    >from {file.oldPath}</span
                  >
                {/if}
                {#if file.binary}
                  <span
                    class="binary-marker"
                    data-testid="complete-diff-binary-marker"
                    aria-label="Binary file">Binary</span
                  >
                {/if}
                {#if file.isTruncated}
                  <span class="truncated-marker" aria-label="Truncated content">
                    Truncated{file.truncationReason ? ` — ${file.truncationReason}` : ''}
                  </span>
                {/if}
              </header>

              {#if file.hunks.length > 0}
                <div class="hunks">
                  {#each file.hunks as hunk (file.path + hunk.header)}
                    <div class="hunk" data-testid="complete-diff-hunk">
                      <div class="hunk-header">{hunk.header}</div>
                      {#each hunk.lines as line, i (file.path + hunk.header + i)}
                        <div
                          class="diff-line diff-line-{line.changeType}"
                          class:no-newline={line.noNewlineAtEnd}
                        >
                          <span class="line-prefix" aria-hidden="true">
                            {line.changeType === 'added'
                              ? '+'
                              : line.changeType === 'deleted'
                                ? '-'
                                : ' '}
                          </span>
                          <span class="line-content">{line.content}</span>
                        </div>
                      {/each}
                    </div>
                  {/each}
                </div>
              {:else if !file.binary}
                <p class="no-hunks" role="status">No textual changes</p>
              {/if}
            </section>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .complete-diff-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--surface-primary);
  }

  .complete-diff-inner {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .complete-diff-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    flex: 1;
    padding: var(--space-8) var(--space-4);
    color: var(--text-secondary);
    text-align: center;
    font-size: var(--text-sm);
  }

  .complete-diff-error {
    color: var(--state-error-border);
  }

  .retry-btn {
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

  .truncation-notice {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--state-error-border);
    background: var(--state-error-bg);
    color: var(--severity-critical);
    font-size: var(--text-xs);
  }

  .complete-diff-index {
    display: flex;
    flex-direction: column;
    max-height: 240px;
    overflow-y: auto;
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .index-entry {
    border-bottom: 1px solid var(--border-subtle);
  }

  .index-entry-button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-3);
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: var(--text-xs);
    font-family: var(--font-family-mono, monospace);
    text-align: left;
    cursor: pointer;
  }

  .index-entry-button:hover {
    background: var(--surface-hover);
  }

  .index-entry-button:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .index-status {
    color: var(--text-tertiary);
    flex-shrink: 0;
    width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .index-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .index-marker {
    flex-shrink: 0;
    color: var(--text-tertiary);
  }

  .complete-diff-sections {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .file-diff-section {
    border-bottom: 1px solid var(--border-default);
  }

  .file-diff-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-secondary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .file-diff-path {
    margin: 0;
    font-size: var(--text-sm);
    font-family: var(--font-family-mono, monospace);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .file-diff-old-path {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .binary-marker,
  .truncated-marker {
    font-size: var(--text-xs);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
  }

  .binary-marker {
    background: var(--text-tertiary);
    color: var(--text-inverse);
  }

  .truncated-marker {
    background: var(--state-error-bg);
    color: var(--severity-critical);
  }

  .no-hunks {
    padding: var(--space-3);
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .hunk {
    padding: var(--space-1) 0;
  }

  .hunk-header {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .diff-line {
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    font-size: var(--text-xs);
    font-family: var(--font-family-mono, monospace);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .diff-line-context {
    color: var(--text-secondary);
  }

  .diff-line-added {
    color: var(--diff-added-fg);
    background: color-mix(in srgb, var(--diff-added-bg) 40%, transparent);
  }

  .diff-line-deleted {
    color: var(--diff-deleted-fg);
    background: color-mix(in srgb, var(--diff-deleted-bg) 40%, transparent);
  }

  .diff-line.no-newline .line-content {
    text-decoration: underline wavy;
    text-underline-offset: 3px;
  }

  .line-prefix {
    flex-shrink: 0;
    user-select: none;
  }

  .line-content {
    flex: 1;
    min-width: 0;
  }
</style>
