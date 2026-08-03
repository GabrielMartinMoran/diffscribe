<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { Folder, Info, LoaderCircle } from 'svelte-lucide';

  import {
    projectTreeLoader,
    type ProjectTreeNode as LoadedTreeNode,
  } from '$lib/web/services/project-tree-loader';
  import { openFileTab, setActiveFile } from '$lib/web/stores/active-file-store';
  import type { ComparisonDraft } from '$lib/web/types/comparison-draft';
  import { createRequestGuard, type RequestGuard } from '$lib/web/utils/request-guard';

  import ProjectTreeNode from './project-tree-node.svelte';

  interface FileEntry {
    path: string;
    status: string;
    binary: boolean;
  }

  interface FileListResult {
    entries: FileEntry[];
    readAt: string;
    error?: { message: string; errorCode: string };
  }

  let {
    activeWorkspaceId = null as string | null,
    comparisonDraft = null as ComparisonDraft | null,
  }: {
    activeWorkspaceId: string | null;
    comparisonDraft: ComparisonDraft | null;
  } = $props();

  let treeData = $state<LoadedTreeNode[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let changeStatusMap = new SvelteMap<string, string>();

  // Request guards: comparison/status fetches race when the comparison
  // changes; stale responses must never overwrite newer tree state.
  const treeGuard: RequestGuard = createRequestGuard();
  const statusGuard: RequestGuard = createRequestGuard();

  // Fetch tree when workspace changes (shared loader caches per workspace).
  $effect(() => {
    if (activeWorkspaceId) {
      fetchTree();
      fetchChangeStatus();
    } else {
      treeData = [];
      changeStatusMap.clear();
      error = null;
    }
  });

  async function fetchTree(): Promise<void> {
    if (!activeWorkspaceId) return;
    const generation = treeGuard.begin();
    loading = true;
    error = null;
    try {
      const snapshot = await projectTreeLoader.load(activeWorkspaceId);
      if (!treeGuard.isCurrent(generation)) return;
      if (snapshot) {
        treeData = snapshot.tree;
      } else {
        error = 'Failed to load project tree';
        treeData = [];
      }
    } finally {
      if (treeGuard.isCurrent(generation)) {
        loading = false;
      }
    }
  }

  async function fetchChangeStatus(): Promise<void> {
    if (!activeWorkspaceId || !comparisonDraft) return;
    const generation = statusGuard.begin();
    try {
      const comparisonParam = encodeURIComponent(JSON.stringify(comparisonDraft));
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/file-list?comparison=${comparisonParam}`,
      );
      if (!statusGuard.isCurrent(generation)) return;
      const data: FileListResult = await res.json();
      if (!statusGuard.isCurrent(generation)) return;
      if (!data.error) {
        changeStatusMap.clear();
        for (const entry of data.entries) {
          changeStatusMap.set(entry.path, entry.status);
        }
      }
    } catch {
      // Non-critical — tree renders without change indicators
    }
  }

  function getStatus(path: string): string | undefined {
    return changeStatusMap.get(path);
  }

  function handleFileClick(path: string, newTab = false): void {
    if (newTab) {
      openFileTab(path, undefined, true);
    } else {
      setActiveFile(path);
    }
  }
</script>

{#if loading}
  <div
    class="tree-status"
    data-testid="project-tree"
    role="status"
    aria-label="Loading project tree"
  >
    <LoaderCircle class="spin-icon" size="20" ariaLabel="Loading" />
    <span>Loading project tree…</span>
  </div>
{:else if error}
  <div class="tree-status tree-error" data-testid="project-tree" role="alert">
    <Info size="20" ariaLabel="Error" />
    <span>{error}</span>
  </div>
{:else if !activeWorkspaceId}
  <div class="tree-status" data-testid="project-tree" role="status">
    <Folder size="20" ariaLabel="Folder" />
    <span class="placeholder-hint">Select a workspace to browse files.</span>
  </div>
{:else if treeData.length === 0}
  <div class="tree-status" data-testid="project-tree" role="status">
    <Folder size="20" ariaLabel="Folder" />
    <span>This repository is empty.</span>
  </div>
{:else}
  <div class="project-tree" data-testid="project-tree" role="tree" aria-label="Project files">
    {#each treeData as node (node.path)}
      <ProjectTreeNode
        {node}
        depth={0}
        status={getStatus(node.path)}
        statusMap={changeStatusMap}
        onFileClick={handleFileClick}
      />
    {/each}
  </div>
{/if}

<style>
  .project-tree {
    display: flex;
    flex-direction: column;
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    user-select: none;
    padding: var(--space-1) 0;
    /* Scroll ownership: the tree scrolls inside the contextual panel
       instead of being clipped by it. */
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .tree-status {
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

  .tree-error {
    color: var(--text-error);
  }

  .placeholder-hint {
    color: var(--text-tertiary);
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
