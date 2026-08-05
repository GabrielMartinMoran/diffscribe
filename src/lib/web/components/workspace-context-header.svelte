<script lang="ts">
  import type { WorkspaceListItem } from '$lib/server/application/dto/results/workspace-results';

  let {
    workspace = null as WorkspaceListItem | null,
  }: {
    workspace?: WorkspaceListItem | null;
  } = $props();
</script>

<!-- 0003: active workspace context at the top of Project/Git/Settings panel
     content. Non-scrolling (flex-shrink: 0); the repository path truncates
     with an ellipsis and exposes the full path as a tooltip. -->
{#if workspace}
  <div class="workspace-context-header" data-testid="workspace-context-header">
    <span class="ws-name" data-testid="workspace-context-name">{workspace.displayName}</span>
    <span class="ws-path" data-testid="workspace-context-path" title={workspace.repositoryPath}>
      {workspace.repositoryPath}
    </span>
  </div>
{/if}

<style>
  .workspace-context-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
    min-width: 0;
  }

  .ws-name {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ws-path {
    font-size: var(--text-xs);
    font-family: var(--font-family-mono, monospace);
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
