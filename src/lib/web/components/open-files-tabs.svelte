<script lang="ts">
  import { FileText, ListChecks, X } from 'svelte-lucide';

  import {
    activateTab,
    activeTabId,
    closeTab,
    openTabs,
    tabId,
  } from '$lib/web/stores/active-file-store';

  const TABPANEL_ID = 'open-files-panel';

  let tabRefs: (HTMLDivElement | null)[] = [];

  function focusedTabIndex(): number {
    const focusedId = document.activeElement?.id;
    const tabs = $openTabs;
    const idx = tabs.findIndex((t) => `open-file-tab-${tabId(t)}` === focusedId);
    return idx >= 0
      ? idx
      : Math.max(
          0,
          tabs.findIndex((t) => tabId(t) === $activeTabId),
        );
  }

  function handleKeydown(e: KeyboardEvent): void {
    const tabs = $openTabs;
    if (tabs.length === 0) return;
    let nextIndex: number | undefined;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = (focusedTabIndex() + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = (focusedTabIndex() - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    tabRefs[nextIndex]?.focus();
  }
</script>

<div
  data-testid="open-files-tabs"
  class="open-files-tabs"
  role="tablist"
  aria-label="Open files"
  tabindex="-1"
  onkeydown={handleKeydown}
>
  {#each $openTabs as tab, i (tabId(tab))}
    {@const id = tabId(tab)}
    {@const isActive = id === $activeTabId}
    {@const isPinned = tab.kind === 'complete-diff'}
    <!-- Pinned complete-diff tab: non-closable, rendered without a close button; middle-click never closes it. -->
    <div
      id={isPinned ? 'pinned-complete-diff-tab' : `open-file-tab-${id}`}
      class="file-tab"
      class:active={isActive}
      class:inactive={!isActive}
      role="tab"
      tabindex={isActive ? 0 : -1}
      aria-selected={isActive}
      aria-controls={TABPANEL_ID}
      data-testid={isPinned ? 'pinned-complete-diff-tab' : 'open-file-tab'}
      bind:this={tabRefs[i]}
      onclick={() => activateTab(id)}
      onauxclick={isPinned
        ? undefined
        : (e) => {
            // W10: middle-click closes any open tab (active or inactive) with
            // the existing close-selection rules.
            if (e.button === 1) {
              e.preventDefault();
              closeTab(tabId(tab));
            }
          }}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateTab(id);
        }
      }}
    >
      {#if isPinned}
        <ListChecks size="14" strokeWidth="1.5" ariaLabel="Complete diff" />
        <span class="file-label">{tab.label}</span>
      {:else}
        <FileText size="14" strokeWidth="1.5" ariaLabel="File" />
        <span class="file-label">{tab.label}</span>
        <button
          class="close-btn"
          aria-label="Close {tab.label}"
          data-testid="close-file-tab"
          onclick={(e) => {
            e.stopPropagation();
            closeTab(tab.path);
          }}
        >
          <X size="12" strokeWidth="2" ariaLabel="Close" />
        </button>
      {/if}
    </div>
  {/each}
</div>

{#if $openTabs.length === 0}
  <div class="file-tab-empty" id={TABPANEL_ID} role="tabpanel" aria-label="No file selected">
    <span class="empty-text">No file selected</span>
  </div>
{:else}
  <div id={TABPANEL_ID} role="tabpanel" aria-label="File content" class="tab-panel-anchor"></div>
{/if}

<style>
  .open-files-tabs {
    display: flex;
    align-items: center;
    gap: 0;
    height: 32px;
    padding: 0 var(--space-1);
    background: var(--surface-secondary);
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .file-tab {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-bottom: none;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: var(--text-xs);
    white-space: nowrap;
    max-width: 200px;
    cursor: pointer;
    outline: none;
  }

  .file-tab:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  /* Active tab has no bottom border; inactive tabs show a subtle one. */
  .file-tab.active {
    border-bottom: none;
  }

  .file-tab.inactive {
    color: var(--text-tertiary);
    background: color-mix(in srgb, var(--surface-primary) 60%, var(--surface-secondary));
    border-color: var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  .file-tab.inactive .close-btn {
    opacity: 0.4;
  }

  .file-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1px;
    border: none;
    border-radius: 2px;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    opacity: 0.6;
    transition:
      opacity 0.1s,
      background 0.1s;
  }

  .close-btn:hover {
    opacity: 1;
    background: var(--surface-hover);
  }

  .close-btn:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
  }

  .file-tab-empty {
    display: flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }

  .empty-text {
    font-style: italic;
  }

  /* The panel anchor carries the tabpanel semantics; the real content is
     rendered by the work area below the strip. */
  .tab-panel-anchor {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }
  }
</style>
