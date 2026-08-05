<script lang="ts">
  import { LoaderCircle, Search, TriangleAlert } from 'svelte-lucide';

  import type { FileChangeStatus } from '$lib/server/domain/value-objects/file-change-status';
  import { statusLabel, statusTone } from '$lib/web/components/file-status';
  import StatusBadge from '$lib/web/components/ui/StatusBadge.svelte';
  import { loadStatusMap } from '$lib/web/services/file-list-status-loader';
  import {
    flattenFiles,
    projectTreeLoader,
    type ProjectTreeNode,
  } from '$lib/web/services/project-tree-loader';
  import { type ScoredFile, scoreFiles } from '$lib/web/services/quick-open-scorer';
  import { removeLegacyQuickOpenSetting } from '$lib/web/stores/quick-open-store';
  import type { ComparisonDraft } from '$lib/web/types/comparison-draft';

  let {
    open = false,
    activeWorkspaceId = null as string | null,
    comparisonDraft = null as ComparisonDraft | null,
    onAccept = undefined as ((path: string, newTab: boolean) => void) | undefined,
    onClose = undefined as (() => void) | undefined,
  }: {
    open?: boolean;
    activeWorkspaceId?: string | null;
    comparisonDraft?: ComparisonDraft | null;
    onAccept?: (path: string, newTab: boolean) => void;
    onClose?: () => void;
  } = $props();

  const LISTBOX_ID = 'quick-open-listbox';
  const INPUT_ID = 'quick-open-input';

  let dialogRef = $state<HTMLDialogElement>();
  let inputRef = $state<HTMLInputElement>();
  let listRef = $state<HTMLDivElement>();
  let query = $state('');
  let index = $state<ProjectTreeNode[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let statusMap = $state<Map<string, FileChangeStatus> | null>(null);
  let activeIndex = $state(0);

  // Native modal: showModal() when open, close() when dismissed. The browser
  // handles Escape (cancel event) and restores focus to the invoker.
  $effect(() => {
    const dialog = dialogRef;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  // Reset state and autofocus the filter whenever the dialog opens. The
  // obsolete include-untracked localStorage key is cleaned on every open.
  $effect(() => {
    if (!open) return;
    query = '';
    activeIndex = 0;
    error = null;
    statusMap = null;
    removeLegacyQuickOpenSetting(window.localStorage);
    // Wait for the dialog to mount before focusing the input.
    const timer = window.setTimeout(() => {
      inputRef?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  });

  // Load the shared Project tree index for the workspace.
  $effect(() => {
    if (!open || !activeWorkspaceId) {
      index = [];
      return;
    }
    let cancelled = false;
    loading = true;
    error = null;
    projectTreeLoader.load(activeWorkspaceId).then((snapshot) => {
      if (cancelled) return;
      loading = false;
      if (!snapshot) {
        error = 'Failed to load project tree';
        index = [];
        return;
      }
      index = flattenFiles(snapshot.tree);
    });
    return () => {
      cancelled = true;
    };
  });

  // Join the comparison-aware file-list status map by path; failures and
  // missing comparisons degrade to no badges.
  $effect(() => {
    if (!open || !activeWorkspaceId || !comparisonDraft) {
      statusMap = null;
      return;
    }
    let cancelled = false;
    loadStatusMap(activeWorkspaceId, comparisonDraft).then((map) => {
      if (cancelled) return;
      statusMap = map;
    });
    return () => {
      cancelled = true;
    };
  });
  // Scoring is pure and derived: every keystroke re-scores the flattened
  // index (capped at 512 results by the scorer). Status rides along through
  // the scorer without affecting ranking.
  const statusByPath = $derived(statusMap);
  const indexWithStatus = $derived(
    statusByPath ? index.map((f) => ({ ...f, status: statusByPath.get(f.path) })) : index,
  );
  const results = $derived(scoreFiles(indexWithStatus, query));

  // Keep the active index inside the result bounds.
  $effect(() => {
    if (activeIndex >= results.length) {
      activeIndex = Math.max(0, results.length - 1);
    }
  });

  function accept(result: ScoredFile | undefined, newTab: boolean): void {
    if (!result) return;
    onAccept?.(result.path, newTab);
    onClose?.();
  }

  function acceptCurrentTab(result: ScoredFile | undefined): void {
    accept(result, false);
  }

  function acceptNewTab(result: ScoredFile | undefined): void {
    accept(result, true);
  }

  function scrollActiveIntoView(): void {
    const list = listRef;
    const item = list?.querySelector(`[data-quick-open-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }

  function handleInputKeydown(e: KeyboardEvent): void {
    // Composing IME input must never accept, navigate, or close.
    if (e.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (results.length > 0) {
          activeIndex = (activeIndex + 1) % results.length;
          scrollActiveIntoView();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (results.length > 0) {
          activeIndex = (activeIndex - 1 + results.length) % results.length;
          scrollActiveIntoView();
        }
        break;
      case 'Home':
        e.preventDefault();
        activeIndex = 0;
        scrollActiveIntoView();
        break;
      case 'End':
        e.preventDefault();
        activeIndex = Math.max(0, results.length - 1);
        scrollActiveIntoView();
        break;
      case 'Enter':
        e.preventDefault();
        // Ctrl/Cmd+Enter opens a new tab; Enter opens the current tab.
        if (e.ctrlKey || e.metaKey) {
          acceptNewTab(results[activeIndex]);
        } else {
          acceptCurrentTab(results[activeIndex]);
        }
        break;
      default:
        break;
    }
  }

  function handleDialogKeydown(e: KeyboardEvent): void {
    // Escape closes the dialog (bubbled from the focused input). The native
    // dialog cancel event is not relied on because the combobox captures
    // keydown first; we close explicitly and let the effect call close().
    if (e.key === 'Escape' && !e.isComposing) {
      e.preventDefault();
      onClose?.();
    }
  }

  // Split a scored path into highlighted/non-highlighted text parts.
  function splitHighlighted(
    result: ScoredFile,
  ): { key: string; text: string; highlighted: boolean }[] {
    const parts: { key: string; text: string; highlighted: boolean }[] = [];
    let cursor = 0;
    const sorted = [...result.highlights].sort((a, b) => a.start - b.start);
    for (const range of sorted) {
      if (range.start > cursor) {
        parts.push({
          key: `p${cursor}`,
          text: result.path.slice(cursor, range.start),
          highlighted: false,
        });
      }
      parts.push({
        key: `h${range.start}-${range.end}`,
        text: result.path.slice(range.start, range.end),
        highlighted: true,
      });
      cursor = Math.max(cursor, range.end);
    }
    if (cursor < result.path.length) {
      parts.push({ key: `p${cursor}`, text: result.path.slice(cursor), highlighted: false });
    }
    return parts;
  }
</script>

<dialog
  bind:this={dialogRef}
  class="quick-open-dialog"
  aria-modal="true"
  aria-labelledby="quick-open-title"
  onkeydown={handleDialogKeydown}
>
  <h2 id="quick-open-title" class="quick-open-title">Quick Open</h2>

  <div class="quick-open-input-row">
    <Search size="14" class="quick-open-search-icon" aria-hidden="true" />
    <input
      id={INPUT_ID}
      bind:this={inputRef}
      bind:value={query}
      class="quick-open-input"
      type="text"
      role="combobox"
      aria-expanded={results.length > 0 || loading || error !== null}
      aria-controls={LISTBOX_ID}
      aria-activedescendant={results[activeIndex] ? `quick-open-result-${activeIndex}` : undefined}
      aria-label="Filter files"
      placeholder="Search files…"
      onkeydown={handleInputKeydown}
    />
  </div>

  <div
    id={LISTBOX_ID}
    bind:this={listRef}
    class="quick-open-listbox"
    role="listbox"
    aria-label="Files"
  >
    {#if loading}
      <div class="quick-open-state" role="status">
        <LoaderCircle class="spin-icon" size="16" ariaLabel="Loading" />
        <span>Loading files…</span>
      </div>
    {:else if error}
      <div class="quick-open-state quick-open-error" role="alert">
        <TriangleAlert size="16" ariaLabel="Error" />
        <span>{error}</span>
      </div>
    {:else if results.length === 0}
      <div class="quick-open-state quick-open-empty" role="status">
        <span>No matching files</span>
      </div>
    {:else}
      {#each results as result, i (result.path)}
        <div
          id="quick-open-result-{i}"
          class="quick-open-result"
          class:active={i === activeIndex}
          role="option"
          aria-selected={i === activeIndex}
          tabindex="-1"
          data-quick-open-index={i}
          data-testid="quick-open-result"
          onclick={() => acceptCurrentTab(result)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              acceptCurrentTab(result);
            }
          }}
        >
          <span class="quick-open-path">
            {#if result.highlights.length > 0}
              {@render HighlightedPath(result)}
            {:else}
              {result.path}
            {/if}
          </span>
          {#if result.status}
            <StatusBadge tone={statusTone(result.status)} data-testid="quick-open-status-badge">
              {statusLabel(result.status)}
            </StatusBadge>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</dialog>

<!-- Renders the path with <mark> highlights for matched ranges. -->
{#snippet HighlightedPath(result: ScoredFile)}
  {#each splitHighlighted(result) as part (part.key)}
    {#if part.highlighted}
      <mark class="quick-open-mark">{part.text}</mark>
    {:else}
      {part.text}
    {/if}
  {/each}
{/snippet}

<style>
  /* Layout only applies while the dialog is open: a closed <dialog> must
     keep the UA `display: none` so it never renders or traps focus. */
  .quick-open-dialog[open] {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    background: var(--surface-primary);
    color: var(--text-primary);
    box-shadow: var(--shadow-lg);
    width: min(640px, 92vw);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    z-index: var(--z-modal);
  }

  .quick-open-dialog::backdrop {
    background: var(--surface-overlay);
  }

  .quick-open-title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .quick-open-input-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    padding: var(--space-1) var(--space-2);
  }

  .quick-open-input-row:focus-within {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    border-color: var(--accent);
  }

  :global(.quick-open-search-icon) {
    flex-shrink: 0;
    color: var(--text-tertiary);
  }

  .quick-open-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    outline: none;
  }

  .quick-open-listbox {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    max-height: 40vh;
  }

  .quick-open-result {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    color: var(--text-primary);
    cursor: pointer;
  }

  .quick-open-result.active {
    background: var(--accent-muted);
  }

  .quick-open-result:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .quick-open-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quick-open-mark {
    background: var(--accent-light, rgba(66, 133, 244, 0.18));
    color: var(--text-primary);
    border-radius: 2px;
    padding: 0 1px;
  }

  .quick-open-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-3);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .quick-open-error {
    color: var(--text-error);
  }

  :global(.spin-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.spin-icon) {
      animation: none;
    }
  }
</style>
