<script lang="ts">
  import type { FileListEntry } from '$lib/server/application/dto/results/file-list-results';

  import type { FileTreeNode } from './file-list-tree';
  import { statusLabel, statusTone } from './file-status';
  // Self-import: Svelte supports recursive components.
  import TreeBranch from './file-tree-branch.svelte';
  import StatusBadge from './ui/StatusBadge.svelte';

  let {
    node,
    expandedDirs,
    activeFile,
    onToggleDir,
    onSelect,
  }: {
    node: FileTreeNode;
    expandedDirs: Set<string>;
    activeFile: string | null;
    onToggleDir: (node: FileTreeNode) => void;
    onSelect: (path: string, newTab?: boolean) => void;
  } = $props();

  const isExpanded = $derived(expandedDirs.has(node.path));
</script>

{#if node.kind === 'directory'}
  <div
    class="tree-branch"
    role="treeitem"
    aria-expanded={isExpanded}
    aria-selected="false"
    data-testid="file-tree-node-{node.path}"
  >
    <button
      class="tree-toggle"
      data-testid="file-tree-toggle-{node.path}"
      aria-expanded={isExpanded}
      aria-label="Toggle {node.name}"
      onclick={() => onToggleDir(node)}
    >
      <span class="tree-caret" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
      <span class="tree-name">{node.name}</span>
    </button>
    {#if isExpanded}
      <div class="tree-children" role="group">
        {#each node.children as child (child.path)}
          <TreeBranch node={child} {expandedDirs} {activeFile} {onToggleDir} {onSelect} />
        {/each}
      </div>
    {/if}
  </div>
{:else}
  {@const entry = node.entry as FileListEntry}
  <button
    class="tree-file"
    class:active={activeFile === node.path}
    role="treeitem"
    aria-selected={activeFile === node.path}
    data-testid="file-tree-node-{node.path}"
    onclick={(e) => onSelect(node.path, e.ctrlKey || e.metaKey)}
  >
    <span class="tree-name">{node.name}</span>
    <StatusBadge tone={statusTone(entry.status)}>{statusLabel(entry.status)}</StatusBadge>
  </button>
{/if}

<style>
  .tree-branch {
    display: flex;
    flex-direction: column;
  }

  .tree-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .tree-toggle:hover {
    background: var(--surface-hover);
  }

  .tree-toggle:focus-visible,
  .tree-file:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .tree-caret {
    width: 14px;
    flex-shrink: 0;
    color: var(--text-tertiary);
  }

  .tree-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-children {
    display: flex;
    flex-direction: column;
    padding-left: var(--space-4);
  }

  .tree-file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .tree-file:hover {
    background: var(--surface-hover);
  }

  .tree-file.active {
    background: var(--accent-muted);
  }
</style>
