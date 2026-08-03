<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { ObservationDraftStore } from '$lib/web/stores/observation-draft-store.svelte';
  import type { ObservationResult } from '$lib/web/stores/observation-store';
  import type { ComparisonDraft } from '$lib/web/types/comparison-draft';

  import ObservationCard from './observation-card.svelte';
  import ObservationForm from './observation-form.svelte';

  let {
    activeWorkspaceId = null as string | null,
    activeReview = null as { id: string; status: string } | null,
    comparisonDraft = null as ComparisonDraft | null,
    draft,
    selectionInfo = null as {
      filePath: string;
      side: string;
      startLine: number;
      endLine: number;
      rawSnapshot: string;
    } | null,
    onCancelSelection = () => {},
  }: {
    activeWorkspaceId: string | null;
    activeReview: { id: string; status: string } | null;
    comparisonDraft: ComparisonDraft | null;
    draft: ObservationDraftStore;
    selectionInfo: {
      filePath: string;
      side: string;
      startLine: number;
      endLine: number;
      rawSnapshot: string;
    } | null;
    onCancelSelection?: () => void;
  } = $props();

  let observations = $state<ObservationResult[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let showForm = $state(false);

  let isReadOnly = $derived(
    activeReview?.status === 'completed' || activeReview?.status === 'archived',
  );

  // Fetch observations when review changes
  $effect(() => {
    if (activeReview && activeWorkspaceId) {
      loadObservations();
    } else {
      observations = [];
    }
  });

  // A new line selection opens the form in creation mode automatically.
  // The form stays open while a selection exists; a pristine draft without a
  // selection closes it (e.g. after a discard).
  $effect(() => {
    if (selectionInfo) {
      showForm = true;
    } else if (draft.status === 'pristine') {
      showForm = false;
    }
  });

  async function loadObservations() {
    if (!activeWorkspaceId || !activeReview) return;
    loading = true;
    error = null;
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${activeReview.id}/observations`,
      );
      if (!res.ok) throw new Error('Failed to load observations');
      const data: ObservationResult[] = await res.json();
      observations = data;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (!activeWorkspaceId || !activeReview) return;
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${activeReview.id}/observations/${id}`,
        { method: 'DELETE' },
      );
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        error = data.error ?? 'Failed to delete';
        return;
      }
      observations = observations.filter((o) => o.id !== id);
      invalidateAll();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to delete';
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    if (!activeWorkspaceId || !activeReview) return;
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${activeReview.id}/observations/${id}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        error = data.error ?? 'Failed to change status';
        return;
      }
      const updated: ObservationResult = await res.json();
      observations = observations.map((o) => (o.id === id ? updated : o));
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to change status';
    }
  }

  function handleCreated() {
    showForm = false;
    loadObservations();
    invalidateAll();
  }

  function handleCancel() {
    // A dirty draft asks for confirmation (keep vs discard) before being
    // dropped; a pristine draft closes and clears the selection directly.
    if (draft.isDirty) {
      draft.requestReplacement();
      return;
    }
    draft.reset();
    showForm = false;
    // Discarding the draft clears the selection in the diff viewer.
    onCancelSelection();
  }

  function handleEdit(id: string) {
    // For now, just scroll to the card. Full edit modal can be added later.
    document.querySelector(`[data-obs-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth' });
  }
</script>

<div class="obs-panel" id="observation-panel">
  <div class="panel-header">
    <h3 class="panel-title">Observations</h3>
    {#if !isReadOnly}
      <button
        class="add-btn"
        onclick={() => (showForm = !showForm)}
        aria-expanded={showForm}
        aria-label={showForm ? 'Close form' : 'Add observation'}
      >
        {showForm ? 'Cancel' : '+ Add'}
      </button>
    {/if}
  </div>

  {#if showForm && !isReadOnly}
    <ObservationForm
      {activeWorkspaceId}
      activeReviewId={activeReview?.id ?? null}
      {selectionInfo}
      {comparisonDraft}
      {draft}
      autofocusBody={!!selectionInfo}
      onCreated={handleCreated}
      onCancel={handleCancel}
    />
  {/if}

  {#if isReadOnly}
    <div class="readonly-notice">This review is completed — read-only</div>
  {/if}

  {#if error}
    <div class="panel-error" role="alert">{error}</div>
  {/if}

  {#if loading}
    <div class="panel-loading">Loading observations...</div>
  {:else if observations.length === 0}
    <div class="panel-empty">
      {isReadOnly
        ? 'No observations on this review.'
        : 'No observations yet. Select lines in the diff viewer and add one.'}
    </div>
  {:else}
    <div class="obs-list">
      {#each observations as obs (obs.id)}
        <div data-obs-id={obs.id}>
          <ObservationCard
            observation={obs}
            staleStatus={null}
            readOnly={isReadOnly}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .obs-panel {
    padding: var(--space-3);
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
  }

  .panel-title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 600;
  }

  .add-btn {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--text-inverse);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .add-btn:hover {
    opacity: 0.9;
  }

  .readonly-notice {
    padding: var(--space-2);
    margin-bottom: var(--space-2);
    background: var(--surface-warning);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--text-warning);
  }

  .panel-error {
    padding: var(--space-2);
    margin-bottom: var(--space-2);
    background: var(--surface-error);
    border-radius: var(--radius-sm);
    color: var(--text-error);
    font-size: var(--text-sm);
  }

  .panel-loading,
  .panel-empty {
    text-align: center;
    padding: var(--space-4);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .obs-list {
    display: flex;
    flex-direction: column;
  }
</style>
