<script lang="ts">
  let { activeWorkspaceName = null as string | null }: { activeWorkspaceName: string | null } =
    $props();
</script>

<main class="main-panel" aria-label="Main content">
  {#if activeWorkspaceName}
    <div class="placeholder">
      <h2>{activeWorkspaceName}</h2>
      <p>Diff and file views coming in a future release.</p>
    </div>
  {:else}
    <div class="placeholder empty">
      <h2>DiffScribe</h2>
      <p>Select a workspace from the sidebar to begin.</p>
    </div>
  {/if}
</main>

<style>
  .main-panel {
    grid-area: main;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--space-8);
    background: var(--surface-secondary);
  }

  .placeholder {
    text-align: center;
    max-width: 500px;
  }

  .placeholder h2 {
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--space-3);
  }

  .placeholder p {
    color: var(--text-secondary);
    font-size: var(--text-base);
    line-height: var(--line-height-normal);
  }

  .placeholder.empty h2 {
    color: var(--text-tertiary);
  }
</style>
