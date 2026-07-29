<script lang="ts">
  import type { WorkspaceListItem } from '$lib/server/application/dto/results/workspace-results';

  import WorkspaceNavItem from './workspace-nav-item.svelte';

  let {
    workspaces = [] as WorkspaceListItem[],
    activeWorkspaceId = null as string | null,
  }: {
    workspaces: WorkspaceListItem[];
    activeWorkspaceId: string | null;
  } = $props();
</script>

<nav id="workspace-sidebar" aria-label="Workspaces" class="sidebar">
  <h2 class="sidebar-title">Workspaces</h2>

  {#if workspaces.length === 0}
    <p class="empty-state">No workspaces yet</p>
  {:else}
    <ul class="workspace-list" role="list">
      {#each workspaces as ws (ws.id)}
        <WorkspaceNavItem workspace={ws} isActive={ws.id === activeWorkspaceId} />
      {/each}
    </ul>
  {/if}
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .sidebar-title {
    padding: var(--space-4);
    font-size: var(--text-lg);
    font-weight: var(--font-weight-semibold);
    border-bottom: 1px solid var(--border-subtle);
    margin: 0;
  }

  .empty-state {
    padding: var(--space-4);
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    text-align: center;
  }

  .workspace-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar * {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
