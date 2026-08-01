<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { ChevronRight, File, Folder, FolderOpen } from 'svelte-lucide';

  import ProjectTreeNode from './project-tree-node.svelte';

  // Client-side mirror of server WorkspaceTreeNode
  interface TreeNode {
    name: string;
    path: string;
    kind: 'file' | 'directory';
    children?: TreeNode[];
    tracked?: boolean;
  }

  let {
    node,
    depth = 0,
    status = undefined as string | undefined,
    statusMap = undefined as Map<string, string> | undefined,
    onFileClick = undefined as ((path: string) => void) | undefined,
  }: {
    node: TreeNode;
    depth: number;
    status?: string;
    statusMap?: Map<string, string>;
    onFileClick?: (path: string) => void;
  } = $props();

  let expanded = $state(false);
  let isDirectory = $derived(node.kind === 'directory');

  function toggleExpand(): void {
    expanded = !expanded;
  }

  function handleClick(): void {
    if (isDirectory) {
      toggleExpand();
    } else {
      onFileClick?.(node.path);
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  /** Change type indicator class. */
  function statusClass(s: string | undefined): string {
    if (!s) return '';
    switch (s) {
      case 'modified':
        return 'change-modified';
      case 'added':
        return 'change-added';
      case 'deleted':
        return 'change-deleted';
      case 'untracked':
        return 'change-untracked';
      default:
        return 'change-other';
    }
  }

  let childStatusMap = $derived.by(() => {
    const map = new SvelteMap<string, string>();
    if (statusMap && node.children) {
      for (const child of node.children) {
        const childStatus = statusMap.get(child.path);
        if (childStatus) {
          map.set(child.path, childStatus);
        }
      }
    }
    return map;
  });

  let indentStyle = $derived(`padding-left: ${depth * 16 + 4}px;`);
</script>

<div
  class="tree-node"
  class:tree-node-file={!isDirectory}
  class:tree-node-dir={isDirectory}
  data-testid="tree-node"
  role="treeitem"
  aria-expanded={isDirectory ? expanded : undefined}
  aria-selected={false}
  tabindex="0"
  style={indentStyle}
  onclick={handleClick}
  onkeydown={handleKeydown}
>
  {#if isDirectory}
    <!-- Expand toggle for directories -->
    <span
      class="expand-toggle"
      class:expanded
      data-testid="expand-toggle"
      role="button"
      tabindex="-1"
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      <ChevronRight size="14" ariaLabel="Toggle" />
    </span>

    <!-- Folder icon (open when expanded) -->
    {#if expanded}
      <FolderOpen size="16" strokeWidth="1.5" class="folder-icon open" ariaLabel="Open folder" />
    {:else}
      <Folder size="16" strokeWidth="1.5" class="folder-icon" ariaLabel="Folder" />
    {/if}
  {:else}
    <!-- Spacer to align file entries with directory entries -->
    <span class="file-spacer"></span>

    <!-- File icon -->
    <File size="16" strokeWidth="1.5" class="file-icon" ariaLabel="File" />
  {/if}

  <!-- File/directory name -->
  <span class="node-name" data-testid={isDirectory ? 'dir-entry' : 'file-entry'}>
    {node.name}
  </span>

  <!-- Change status indicator (files only) -->
  {#if !isDirectory && status}
    <span
      class="change-indicator {statusClass(status)}"
      data-testid="change-indicator"
      role="status"
      aria-label={status}
      title={status}
    ></span>
  {/if}
</div>

<!-- Children for directories (only when expanded) -->
{#if isDirectory && expanded && node.children && node.children.length > 0}
  {#each node.children as child (child.path)}
    <ProjectTreeNode
      node={child}
      depth={depth + 1}
      status={childStatusMap.get(child.path)}
      {statusMap}
      {onFileClick}
    />
  {/each}
{/if}

<style>
  .tree-node {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px var(--space-2);
    cursor: pointer;
    white-space: nowrap;
    min-height: 24px;
    color: var(--text-primary);
    outline: none;
  }

  .tree-node:hover {
    background: var(--surface-hover);
  }

  .tree-node:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .tree-node-dir {
    font-weight: var(--font-weight-medium, 500);
  }

  .expand-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
    color: var(--text-tertiary);
  }

  .expand-toggle.expanded {
    transform: rotate(90deg);
  }

  .file-spacer {
    display: inline-block;
    width: 16px;
    flex-shrink: 0;
  }

  .folder-icon,
  .file-icon {
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .folder-icon.open {
    color: var(--accent);
  }

  .node-name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  /* ── Change indicators ── */
  .change-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .change-modified {
    background: var(--tree-status-modified);
    box-shadow: 0 0 4px color-mix(in srgb, var(--tree-status-modified) 40%, transparent);
  }

  .change-added {
    background: var(--tree-status-added);
    box-shadow: 0 0 4px color-mix(in srgb, var(--tree-status-added) 40%, transparent);
  }

  .change-deleted {
    background: var(--tree-status-deleted);
    box-shadow: 0 0 4px color-mix(in srgb, var(--tree-status-deleted) 40%, transparent);
  }

  .change-untracked {
    background: var(--tree-status-untracked);
    box-shadow: 0 0 4px color-mix(in srgb, var(--tree-status-untracked) 40%, transparent);
  }

  .change-other {
    background: var(--tree-status-other);
    box-shadow: 0 0 4px color-mix(in srgb, var(--tree-status-other) 40%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .expand-toggle {
      transition: none;
    }
  }
</style>
