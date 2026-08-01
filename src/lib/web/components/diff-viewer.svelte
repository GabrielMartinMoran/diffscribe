<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags */
  import type { FileDiffResult } from '$lib/server/application/dto/results/file-diff-results';
  import { readStoredWrap, resolveWrap } from '$lib/web/stores/wrap-store';

  interface ComparisonDraft {
    base: { type: string; value: string; label: string };
    target: { type: string; value: string; label: string };
    comparisonType: string;
    createdAt: string;
  }

  let {
    selectedFile = null as string | null,
    comparisonDraft = null as ComparisonDraft | null,
    activeWorkspaceId = null as string | null,
    onSelectionChange = null as
      | ((
          selection: {
            filePath: string;
            side: string;
            startLine: number;
            endLine: number;
            rawSnapshot: string;
          } | null,
        ) => void)
      | null,
  }: {
    selectedFile: string | null;
    comparisonDraft: ComparisonDraft | null;
    activeWorkspaceId: string | null;
    onSelectionChange?:
      | ((
          selection: {
            filePath: string;
            side: string;
            startLine: number;
            endLine: number;
            rawSnapshot: string;
          } | null,
        ) => void)
      | null;
  } = $props();

  let diffResult = $state<FileDiffResult | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let sideBySide = $state(false);
  let wrapLines = $state(false);
  let focusedHunkIndex = $state(0);
  let viewportWidth = $state(0);
  let selectedLines = $state<number[]>([]);
  let selectedLineSide = $state<Record<number, string>>({});
  let anchorLine = $state<number | null>(null);
  let ariaMessage = $state('');

  // Track viewport width for responsive toggle
  $effect(() => {
    const update = () => (viewportWidth = window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });

  // Force unified below 900px
  $effect(() => {
    if (viewportWidth < 900) sideBySide = false;
  });

  // Fetch diff when selectedFile changes
  $effect(() => {
    if (selectedFile && comparisonDraft && activeWorkspaceId) {
      fetchDiff();
    } else if (!selectedFile) {
      diffResult = null;
      error = null;
    }
  });

  // Clear selection state when file changes (no callback needed — parent tracks file)
  $effect(() => {
    selectedLines = [];
    selectedLineSide = {};
    anchorLine = null;
  });

  // Per-file wrap state: start from the global Settings default whenever a
  // different file opens; the contextual toggle overrides it for this file
  // only (not persisted).
  $effect(() => {
    if (!selectedFile) return;
    wrapLines = resolveWrap(readStoredWrap(window.localStorage));
  });

  function toggleWrap() {
    wrapLines = !wrapLines;
  }

  // Ctrl+Shift+D global shortcut
  $effect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (selectedFile) {
          fetchDiff();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Global keyboard shortcuts for diff navigation (j/k/arrows) — active
  // only when a diff is rendered. Guarded by `!diffResult` at top of handler.
  $effect(() => {
    if (!diffResult) return;
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  async function fetchDiff() {
    if (!selectedFile || !comparisonDraft || !activeWorkspaceId) return;
    loading = true;
    error = null;
    diffResult = null;

    try {
      const comparisonParam = encodeURIComponent(JSON.stringify(comparisonDraft));
      const pathParam = encodeURIComponent(selectedFile);
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/file-diff?comparison=${comparisonParam}&path=${pathParam}`,
      );
      const data: FileDiffResult = await res.json();

      if (data.error) {
        error = data.error.message;
        diffResult = null;
      } else {
        diffResult = data;
        focusedHunkIndex = 0;
        // Clear selection on diff refresh
        selectedLines = [];
        anchorLine = null;
        notifySelectionChange();
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load diff';
      diffResult = null;
    } finally {
      loading = false;
    }
  }

  function toggleSideBySide() {
    if (viewportWidth >= 900) sideBySide = !sideBySide;
  }

  function navigateHunk(direction: 'next' | 'previous') {
    if (!diffResult?.hunks) return;
    const count = diffResult.hunks.length;
    if (direction === 'next') {
      focusedHunkIndex = (focusedHunkIndex + 1) % count;
    } else {
      focusedHunkIndex = (focusedHunkIndex - 1 + count) % count;
    }
  }

  // ── Line selection ──

  function selectLine(lineNum: number, side: string, event?: MouseEvent) {
    if (event?.shiftKey && anchorLine !== null) {
      const start = Math.min(anchorLine, lineNum);
      const end = Math.max(anchorLine, lineNum);
      const arr: number[] = [];
      for (let i = start; i <= end; i++) arr.push(i);
      selectedLines = arr;
      selectedLineSide = { ...selectedLineSide, [lineNum]: side };
      announceSelection(start, end);
    } else {
      selectedLines = [lineNum];
      selectedLineSide = { [lineNum]: side };
      anchorLine = lineNum;
      announceSelection(lineNum, lineNum);
    }
    notifySelectionChange();
  }

  function clearSelection() {
    selectedLines = [];
    anchorLine = null;
    notifySelectionChange();
    ariaMessage = 'Selection cleared';
  }

  function announceSelection(start: number, end: number) {
    if (start === end) {
      ariaMessage = `Line ${start} selected`;
    } else {
      ariaMessage = `Lines ${start} through ${end} selected`;
    }
  }

  function notifySelectionChange() {
    if (!onSelectionChange) return;
    if (selectedLines.length === 0 || !selectedFile) {
      onSelectionChange(null);
      return;
    }
    const sorted = selectedLines.slice().sort((a, b) => a - b);
    // Determine dominant side from selected lines
    const firstSide = (selectedLineSide[sorted[0]] as string) ?? 'new';
    // Collect raw diff content for the selected lines
    let rawSnapshot = '';
    if (diffResult?.hunks) {
      for (const hunk of diffResult.hunks) {
        for (const line of hunk.lines) {
          const num = firstSide === 'old' ? line.oldLineNumber : line.newLineNumber;
          if (num && selectedLines.includes(num)) {
            const prefix =
              line.changeType === 'added' ? '+' : line.changeType === 'deleted' ? '-' : ' ';
            rawSnapshot += prefix + (line.text || line.content || '') + '\n';
          }
        }
      }
      rawSnapshot = rawSnapshot.replace(/\n$/, '');
    }
    onSelectionChange({
      filePath: selectedFile,
      side: firstSide,
      startLine: sorted[0],
      endLine: sorted[sorted.length - 1],
      rawSnapshot,
    });
  }

  function extendSelectionUp() {
    if (anchorLine === null) return;
    const newEnd = Math.max(1, anchorLine - 1);
    const start = Math.min(anchorLine, newEnd);
    const end = Math.max(anchorLine, newEnd);
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    selectedLines = arr;
    anchorLine = newEnd;
    announceSelection(start, end);
    notifySelectionChange();
  }

  function extendSelectionDown() {
    if (anchorLine === null) return;
    const maxLine = getMaxLineNumber();
    const newEnd = Math.min(maxLine, anchorLine + 1);
    const start = Math.min(anchorLine, newEnd);
    const end = Math.max(anchorLine, newEnd);
    const arr2: number[] = [];
    for (let i = start; i <= end; i++) arr2.push(i);
    selectedLines = arr2;
    anchorLine = newEnd;
    announceSelection(start, end);
    notifySelectionChange();
  }

  function getMaxLineNumber(): number {
    if (!diffResult?.hunks) return 9999;
    let max = 0;
    for (const hunk of diffResult.hunks) {
      for (const line of hunk.lines) {
        const n = line.newLineNumber ?? line.oldLineNumber ?? 0;
        if (n > max) max = n;
      }
    }
    return max > 0 ? max : 9999;
  }

  // Keyboard: j/k for hunk navigation (without Shift), ArrowDown/Up for line selection with Shift
  function handleKeydown(e: KeyboardEvent) {
    if (!diffResult) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      clearSelection();
      return;
    }

    if (e.key === 'l') {
      // L key: anchor selection at current line (use last clicked or focused line)
      e.preventDefault();
      // This is designed to work when a line is focused/hovered
      return;
    }

    if (e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      extendSelectionDown();
      return;
    }

    if (e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      extendSelectionUp();
      return;
    }

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHunk('next');
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHunk('previous');
    }
  }

  function handleLineClick(lineNum: number, side: string, e: MouseEvent) {
    selectLine(lineNum, side, e);
  }

  function handleLineKeydown(lineNum: number, side: string, e: KeyboardEvent) {
    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      anchorLine = lineNum;
      selectedLines = [lineNum];
      selectedLineSide = { [lineNum]: side };
      announceSelection(lineNum, lineNum);
      notifySelectionChange();
    }
  }

  // Convert new line number to display index
  function getLineNum(lineNum: number | undefined): number {
    if (!lineNum) return 0;
    return lineNum;
  }
</script>

<!-- ARIA live region for selection announcements -->
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {ariaMessage}
</div>

{#if loading}
  <div class="diff-viewer" role="region" aria-label="Diff viewer" aria-busy="true">
    <div class="diff-state diff-loading">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>Loading diff&hellip;</span>
    </div>
  </div>
{:else if error}
  <div class="diff-viewer" role="region" aria-label="Diff viewer">
    <div class="diff-state diff-error">
      <p>{error}</p>
      <button class="retry-btn" onclick={() => fetchDiff()} aria-label="Retry loading diff">
        Retry
      </button>
    </div>
  </div>
{:else if !selectedFile}
  <div class="diff-viewer" role="region" aria-label="Diff viewer">
    <div class="diff-state diff-placeholder">
      <p>Select a file from the list to view its diff.</p>
    </div>
  </div>
{:else if diffResult?.isBinary}
  <div class="diff-viewer" role="region" aria-label="Diff viewer">
    <div class="diff-state diff-binary">
      <p>This file is binary and cannot be displayed as text.</p>
    </div>
  </div>
{:else if diffResult && diffResult.hunks.length === 0}
  <div class="diff-viewer" role="region" aria-label="Diff viewer">
    <div class="diff-state diff-empty">
      <p>This file is empty.</p>
    </div>
  </div>
{:else if diffResult}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="diff-viewer diff-rendered"
    class:wrap-enabled={wrapLines}
    role="region"
    aria-label="Diff viewer"
    tabindex="0"
  >
    <div class="diff-header">
      <span class="diff-path">{diffResult.path}</span>
      {#if diffResult.oldPath && diffResult.oldPath !== diffResult.path}
        <span class="diff-rename">(renamed from {diffResult.oldPath})</span>
      {/if}
      <div class="diff-actions">
        <button
          class="toggle-btn"
          onclick={toggleWrap}
          aria-pressed={wrapLines}
          aria-label={wrapLines ? 'Disable line wrapping' : 'Enable line wrapping'}
        >
          Wrap
        </button>
        {#if viewportWidth >= 900}
          <button
            class="toggle-btn"
            onclick={toggleSideBySide}
            aria-pressed={sideBySide}
            aria-label={sideBySide ? 'Switch to unified view' : 'Switch to side-by-side view'}
          >
            {sideBySide ? 'Unified' : 'Side-by-side'}
          </button>
        {/if}
        <button class="refresh-btn" onclick={() => fetchDiff()} aria-label="Refresh diff">
          Refresh
        </button>
      </div>
    </div>

    {#if diffResult.isTruncated}
      <div class="diff-truncation-notice" role="alert">
        Content truncated: {diffResult.truncationReason ?? 'Content exceeds limits'}
      </div>
    {/if}

    {#if sideBySide}
      <div class="diff-side-by-side">
        {#each diffResult.hunks as hunk, hi (hi)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="hunk" class:focused={hi === focusedHunkIndex} tabindex="0">
            <div class="hunk-header">{hunk.header}</div>
            <div class="hunk-columns">
              <div class="hunk-col old-col">
                {#each hunk.lines.filter((l) => l.changeType !== 'added') as line (line.oldLineNumber + '-' + line.content)}
                  <div
                    class="diff-line diff-line-{line.changeType} sel-line"
                    class:no-newline={line.noNewlineAtEnd}
                    class:selected={line.oldLineNumber
                      ? selectedLines.includes(line.oldLineNumber)
                      : false}
                    data-line-num={line.oldLineNumber}
                    data-side="old"
                    data-selected={line.oldLineNumber
                      ? selectedLines.includes(line.oldLineNumber)
                      : false}
                    role="checkbox"
                    tabindex="0"
                    aria-checked={line.oldLineNumber
                      ? selectedLines.includes(line.oldLineNumber)
                      : false}
                    onclick={(e) => handleLineClick(line.oldLineNumber ?? 0, 'old', e)}
                    onkeydown={(e) => handleLineKeydown(line.oldLineNumber ?? 0, 'old', e)}
                  >
                    <span class="line-number old-number">{line.oldLineNumber || ''}</span>
                    <span class="line-content">
                      {@html line.changeType === 'context' || line.changeType === 'deleted'
                        ? line.html || line.text || line.content
                        : '&nbsp;'}
                    </span>
                  </div>
                {/each}
              </div>
              <div class="hunk-col new-col">
                {#each hunk.lines.filter((l) => l.changeType !== 'deleted') as line (line.newLineNumber + '-' + line.content)}
                  <div
                    class="diff-line diff-line-{line.changeType} sel-line"
                    class:no-newline={line.noNewlineAtEnd}
                    class:selected={line.newLineNumber
                      ? selectedLines.includes(getLineNum(line.newLineNumber))
                      : false}
                    data-line-num={getLineNum(line.newLineNumber)}
                    data-side="new"
                    data-selected={line.newLineNumber
                      ? selectedLines.includes(getLineNum(line.newLineNumber))
                      : false}
                    role="checkbox"
                    tabindex="0"
                    aria-checked={line.newLineNumber
                      ? selectedLines.includes(getLineNum(line.newLineNumber))
                      : false}
                    onclick={(e) => handleLineClick(getLineNum(line.newLineNumber), 'new', e)}
                    onkeydown={(e) => handleLineKeydown(getLineNum(line.newLineNumber), 'new', e)}
                  >
                    <span class="line-number old-number">{line.oldLineNumber || ''}</span>
                    <span class="line-content">
                      {@html line.changeType === 'context' || line.changeType === 'deleted'
                        ? line.html || line.text || line.content
                        : '&nbsp;'}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="diff-unified">
        {#each diffResult.hunks as hunk, hi (hi)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="hunk" class:focused={hi === focusedHunkIndex} tabindex="0">
            <div class="hunk-header">{hunk.header}</div>
            {#each hunk.lines as line, li (li)}
              <div
                class="diff-line diff-line-{line.changeType} sel-line"
                class:no-newline={line.noNewlineAtEnd}
                class:selected={line.newLineNumber
                  ? selectedLines.includes(getLineNum(line.newLineNumber))
                  : false}
                data-line-num={getLineNum(line.newLineNumber)}
                data-side="new"
                data-selected={line.newLineNumber
                  ? selectedLines.includes(getLineNum(line.newLineNumber))
                  : false}
                role="checkbox"
                tabindex="0"
                aria-checked={line.newLineNumber
                  ? selectedLines.includes(getLineNum(line.newLineNumber))
                  : false}
                onclick={(e) => handleLineClick(getLineNum(line.newLineNumber), 'new', e)}
                onkeydown={(e) => handleLineKeydown(getLineNum(line.newLineNumber), 'new', e)}
              >
                <span class="line-number old-number">{line.oldLineNumber || ''}</span>
                <span class="line-number new-number">{line.newLineNumber || ''}</span>
                <span class="line-prefix">
                  {line.changeType === 'added' ? '+' : line.changeType === 'deleted' ? '-' : ' '}
                </span>
                <span class="line-content">
                  {@html line.changeType === 'context' || line.changeType === 'added'
                    ? line.html || line.text || line.content
                    : line.text || line.content}
                </span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .diff-viewer {
    overflow-y: auto;
    overflow-x: auto;
    padding: var(--space-4);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    background: var(--surface-primary);
    color: var(--text-primary);
    /* Scroll ownership: the viewer scrolls inside the work area instead of
       pushing the shell layout. */
    flex: 1;
    min-height: 0;
  }

  /* Wrap mode: long lines wrap inside the viewer. `pre-wrap` keeps code
     whitespace; overflow-wrap/word-break utilities are intentionally not
     used (see docs/design.md — Base UI kit anti-patterns). */
  .diff-viewer.wrap-enabled .diff-line {
    white-space: pre-wrap;
  }

  /* ── State containers ── */
  .diff-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    gap: var(--space-3);
    text-align: center;
    color: var(--text-secondary);
  }

  .diff-loading .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-subtle);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .diff-loading .loading-spinner {
      animation: none;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .diff-error {
    color: var(--text-error);
  }

  .retry-btn,
  .refresh-btn,
  .toggle-btn {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .retry-btn:hover,
  .refresh-btn:hover,
  .toggle-btn:hover {
    background: var(--accent);
    color: var(--text-inverse);
  }

  .retry-btn:focus-visible,
  .refresh-btn:focus-visible,
  .toggle-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .toggle-btn[aria-pressed='true'] {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  /* ── Header ── */
  .diff-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
  }

  .diff-path {
    font-weight: 600;
    color: var(--text-primary);
  }

  .diff-rename {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .diff-actions {
    margin-left: auto;
    display: flex;
    gap: var(--space-1);
  }

  /* ── Truncation ── */
  .diff-truncation-notice {
    padding: var(--space-2);
    margin-bottom: var(--space-3);
    background: var(--surface-warning);
    border: 1px solid var(--border-warning);
    color: var(--text-warning);
    font-size: 12px;
  }

  /* ── Hunks ── */
  .hunk {
    margin-bottom: var(--space-2);
  }

  .hunk.focused {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
    border-radius: var(--radius-sm);
  }

  .hunk-header {
    background: var(--surface-secondary);
    padding: var(--space-1) var(--space-2);
    color: var(--text-secondary);
    font-size: 12px;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  }

  /* ── Diff lines ── */
  .diff-line {
    display: flex;
    align-items: baseline;
    white-space: pre;
    min-height: 20px;
  }

  .sel-line {
    cursor: pointer;
    user-select: none;
  }

  .sel-line:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: -1px;
  }

  .sel-line:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.04));
  }

  .sel-line.selected {
    background: var(--selection-bg, rgba(66, 133, 244, 0.2));
    border-left: 3px solid var(--selection-border);
  }

  .diff-line-context {
    background: transparent;
  }

  .diff-line-added {
    background: var(--diff-added-bg, rgba(0, 255, 0, 0.08));
    color: var(--diff-added-fg);
  }

  .diff-line-deleted {
    background: var(--diff-deleted-bg, rgba(255, 0, 0, 0.08));
    color: var(--diff-deleted-fg);
  }

  .diff-line.no-newline {
    border-bottom: 2px dotted var(--text-secondary);
  }

  .sel-line.selected.diff-line-added {
    background: rgba(0, 200, 0, 0.2);
  }

  .sel-line.selected.diff-line-deleted {
    background: rgba(200, 0, 0, 0.2);
  }

  /* ── Line numbers ── */
  .line-number {
    display: inline-block;
    width: 48px;
    text-align: right;
    padding: 0 var(--space-2);
    color: var(--text-secondary);
    font-size: 11px;
    user-select: none;
    flex-shrink: 0;
  }

  .line-prefix {
    display: inline-block;
    width: 16px;
    text-align: center;
    flex-shrink: 0;
    font-weight: 600;
  }

  .diff-line-added .line-prefix {
    color: var(--diff-added-fg);
  }

  .diff-line-deleted .line-prefix {
    color: var(--diff-deleted-fg);
  }

  .diff-line-context .line-prefix {
    color: var(--text-secondary);
  }

  .line-content {
    flex: 1;
  }

  /* ── Side-by-side ── */
  .hunk-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
  }

  .old-col .diff-line {
    border-right: 1px solid var(--border-subtle);
  }

  /* ── Token spans from Shiki ── */
  .line-content :global(span) {
    font-family: inherit;
    font-size: inherit;
  }
</style>
