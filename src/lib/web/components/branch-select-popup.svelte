<script lang="ts">
  import { LoaderCircle, TriangleAlert } from 'svelte-lucide';

  import type { BranchDto } from '$lib/server/application/dto/results/git-context-results';
  import {
    type BranchOption,
    filterBranchGroups,
    groupBranches,
  } from '$lib/web/utils/branch-options';

  /**
   * Product-specific inline non-modal popup for the Base/Target branch
   * triggers (tranche C). No portal and no native dialog element: the popup
   * renders inside the Git context panel, opens one at a time, autofocuses
   * the search input, and follows the ARIA combobox pattern. The canonical
   * ref is the selection value; the visible label stays short. aria-selected
   * reflects the selected slot value only; the current branch has its own
   * marker.
   */

  let {
    open = false,
    slotLabel = 'Base' as string,
    branches = [] as BranchDto[],
    selectedCanonicalRef = null as string | null,
    workingTreeSelected = false,
    loading = false,
    error = null as string | null,
    triggerRef = null as HTMLElement | null,
    onSelect = undefined as ((canonicalRef: string) => void) | undefined,
    onSelectWorkingTree = undefined as (() => void) | undefined,
    onClose = undefined as (() => void) | undefined,
    onRetry = undefined as (() => void) | undefined,
  }: {
    open?: boolean;
    slotLabel?: string;
    branches?: BranchDto[];
    selectedCanonicalRef?: string | null;
    workingTreeSelected?: boolean;
    loading?: boolean;
    error?: string | null;
    triggerRef?: HTMLElement | null;
    onSelect?: (canonicalRef: string) => void;
    onSelectWorkingTree?: () => void;
    onClose?: () => void;
    onRetry?: () => void;
  } = $props();

  const LISTBOX_ID = 'branch-ref-listbox';
  const INPUT_ID = 'branch-ref-search';

  let inputRef = $state<HTMLInputElement>();
  let listRef = $state<HTMLDivElement>();
  let query = $state('');
  let activeIndex = $state(0);

  // Reset state and autofocus the search whenever the popup opens.
  $effect(() => {
    if (!open) return;
    query = '';
    activeIndex = 0;
    const timer = window.setTimeout(() => {
      inputRef?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  });

  const groups = $derived(groupBranches(branches));

  // Flatten filtered groups into a single ordered option list; group order
  // (Local before Cached remote) and server-side recency are preserved.
  const visibleGroups = $derived(filterBranchGroups(groups, query));
  const visibleOptions = $derived<BranchOption[]>(visibleGroups.flatMap((g) => g.options));

  // W8: when no search query is active, the fixed Working tree pseudo-option
  // leads the keyboard navigation (index 0); typing a query hides it.
  const keyboardOptions = $derived<(BranchOption | null)[]>(
    query.trim() === '' ? [null, ...visibleOptions] : visibleOptions,
  );

  // Keep the active index inside the result bounds.
  $effect(() => {
    if (activeIndex >= keyboardOptions.length) {
      activeIndex = Math.max(0, keyboardOptions.length - 1);
    }
  });

  function activeDescendant(): string | undefined {
    const current = keyboardOptions[activeIndex];
    if (current === undefined) return undefined;
    if (current === null) return 'working-tree-option';
    return `branch-option-${visibleOptions.indexOf(current)}`;
  }

  function scrollActiveIntoView(): void {
    const list = listRef;
    const current = keyboardOptions[activeIndex];
    if (current === undefined) return;
    if (current === null) return; // Working tree option sits at the top.
    const item = list?.querySelector(`[data-branch-index="${visibleOptions.indexOf(current)}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }

  function accept(option: BranchOption | undefined): void {
    if (!option) return;
    onSelect?.(option.canonicalRef);
    onClose?.();
  }

  function acceptWorkingTree(): void {
    onSelectWorkingTree?.();
    onClose?.();
  }

  function acceptActive(): void {
    const current = keyboardOptions[activeIndex];
    if (current === undefined) return;
    if (current === null) {
      acceptWorkingTree();
    } else {
      accept(current);
    }
  }

  function close(): void {
    onClose?.();
    // Restore focus to the trigger that opened the popup.
    triggerRef?.focus();
  }

  function handleKeydown(e: KeyboardEvent): void {
    // Composing IME input must never accept, navigate, or close.
    if (e.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (keyboardOptions.length > 0) {
          activeIndex = (activeIndex + 1) % keyboardOptions.length;
          scrollActiveIntoView();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (keyboardOptions.length > 0) {
          activeIndex = (activeIndex - 1 + keyboardOptions.length) % keyboardOptions.length;
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
        activeIndex = Math.max(0, keyboardOptions.length - 1);
        scrollActiveIntoView();
        break;
      case 'Enter':
        e.preventDefault();
        acceptActive();
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  }
</script>

{#if open}
  <div class="branch-popup" role="region" aria-label="{slotLabel} branch selector">
    <div class="branch-popup-search-row">
      <input
        id={INPUT_ID}
        bind:this={inputRef}
        bind:value={query}
        class="branch-popup-search"
        type="text"
        role="combobox"
        aria-expanded={true}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={activeDescendant()}
        aria-label="Filter branches"
        placeholder="Search branches…"
        onkeydown={handleKeydown}
      />
    </div>

    <div
      id={LISTBOX_ID}
      bind:this={listRef}
      class="branch-popup-listbox"
      role="listbox"
      aria-label="Branches"
    >
      {#if loading}
        <div class="branch-popup-state" role="status">
          <LoaderCircle class="spin-icon" size="16" ariaLabel="Loading" />
          <span>Loading branches…</span>
        </div>
      {:else if error}
        <div class="branch-popup-state branch-popup-error" role="alert">
          <TriangleAlert size="16" ariaLabel="Error" />
          <span>{error}</span>
          <button
            class="branch-popup-retry"
            onclick={() => onRetry?.()}
            aria-label="Retry loading branches"
          >
            Retry
          </button>
        </div>
      {:else if visibleGroups.length === 0 && !workingTreeSelected}
        <div class="branch-popup-state" role="status">
          <span>{query.trim() ? 'No matching branches' : 'No branches'}</span>
        </div>
      {:else}
        <!-- W8: fixed Working tree pseudo-option at the top of the listbox;
             hidden while a search query is active -->
        {#if query.trim() === ''}
          <div
            id="working-tree-option"
            class="branch-option working-tree-option"
            class:active={activeIndex === 0 && keyboardOptions[0] === null}
            class:selected={workingTreeSelected}
            role="option"
            aria-selected={workingTreeSelected}
            aria-label="Working tree"
            tabindex="-1"
            data-branch-option="working-tree"
            title="Working tree"
            onclick={acceptWorkingTree}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                acceptWorkingTree();
              }
            }}
          >
            <span class="branch-option-icon" aria-hidden="true"
              >{workingTreeSelected ? '●' : '○'}</span
            >
            <span class="branch-option-label" title="Working tree">Working tree</span>
          </div>
        {/if}
        {#each visibleGroups as group (group.key)}
          <div class="branch-group" role="presentation">
            <div class="branch-group-title" role="presentation">{group.title}</div>
            {#each group.options as option (option.canonicalRef)}
              {@const globalIndex = visibleOptions.indexOf(option)}
              <div
                id="branch-option-{globalIndex}"
                class="branch-option"
                class:active={globalIndex === activeIndex}
                class:current={option.isCurrent}
                role="option"
                aria-selected={option.canonicalRef === selectedCanonicalRef}
                aria-label={option.isCurrent ? `${option.label}, Current branch` : option.label}
                tabindex="-1"
                data-branch-index={globalIndex}
                onclick={() => accept(option)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    accept(option);
                  }
                }}
              >
                <span class="branch-option-icon" aria-hidden="true">
                  {option.isCurrent ? '●' : '○'}
                </span>
                {#if option.isCurrent}
                  <span class="branch-current-marker" aria-label="Current branch">current</span>
                {/if}
                <span class="branch-option-label" title={option.label}>{option.label}</span>
                {#if option.isRemote}
                  <span class="branch-remote-tag" aria-label="Cached remote branch">remote</span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .branch-popup {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    max-height: min(40vh, 360px);
    padding: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-primary);
    color: var(--text-primary);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-dropdown);
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
  }

  .branch-popup-search-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    padding: var(--space-1) var(--space-2);
  }

  .branch-popup-search-row:focus-within {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    border-color: var(--accent);
  }

  .branch-popup-search {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
    outline: none;
  }

  .branch-popup-listbox {
    overflow-y: auto;
    overflow-x: hidden;
    max-height: min(32vh, 280px);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }

  .branch-group-title {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-2xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
    background: var(--surface-secondary);
    position: sticky;
    top: 0;
  }

  .branch-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-primary);
    cursor: pointer;
  }

  .branch-option.active {
    background: var(--accent-muted);
  }

  .branch-option.current {
    font-weight: var(--font-weight-semibold);
  }

  .branch-option[aria-selected='true'] {
    background: var(--accent-light, rgba(66, 133, 244, 0.12));
  }

  .branch-option:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .branch-option-icon {
    font-size: var(--text-xs);
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }

  .branch-current-marker {
    flex-shrink: 0;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--accent-muted);
    color: var(--accent);
    font-size: var(--text-2xs);
  }

  .branch-option-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .branch-remote-tag {
    margin-left: auto;
    flex-shrink: 0;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--surface-tertiary);
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .branch-popup-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-3);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .branch-popup-error {
    color: var(--text-error);
  }

  .branch-popup-retry {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .branch-popup-retry:hover {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
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
