<script lang="ts">
  import type { ObservationDraftStore } from '$lib/web/stores/observation-draft-store.svelte';
  import type { SelectionInfo } from '$lib/web/stores/observation-store';
  import type { ComparisonDraft } from '$lib/web/types/comparison-draft';

  import Select from './ui/Select.svelte';

  let {
    activeWorkspaceId,
    activeReviewId,
    selectionInfo = null as SelectionInfo | null,
    comparisonDraft = null as ComparisonDraft | null,
    draft,
    autofocusBody = false,
    onCreated = () => {},
    onCancel = () => {},
  }: {
    activeWorkspaceId: string | null;
    activeReviewId: string | null;
    selectionInfo: SelectionInfo | null;
    comparisonDraft: ComparisonDraft | null;
    /** Per-instance draft store owned by the page shell (survives unmount). */
    draft: ObservationDraftStore;
    autofocusBody: boolean;
    onCreated: () => void;
    onCancel: () => void;
  } = $props();

  // Show severity selector only for issue/risk
  let showSeverity = $derived(draft.type === 'issue' || draft.type === 'risk');

  // Form bindings promote pristine → dirty on the first user edit. The reset
  // flow restores the default values, so a pristine draft never re-marks
  // itself dirty after a clear.
  $effect(() => {
    void draft.body;
    void draft.type;
    void draft.severity;
    const hasEdits = draft.body !== '' || draft.type !== 'note' || draft.severity !== null;
    if (hasEdits && draft.status === 'pristine') {
      draft.markEdited();
    }
  });

  // Focus the body field when the form opens for a new selection so the
  // reviewer can type immediately (click-to-comment flow).
  $effect(() => {
    if (!autofocusBody) return;
    requestAnimationFrame(() => {
      document.getElementById('obs-body')?.focus();
    });
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!draft.hasContent || !activeWorkspaceId || draft.isSubmitting) return;

    // Missing context surfaces an inline accessible error instead of a
    // doomed request.
    if (!activeReviewId) {
      draft.showError('Start a review before creating observations');
      return;
    }
    if (!comparisonDraft) {
      draft.showError('Choose a comparison before creating observations');
      return;
    }

    draft.beginSubmit();

    try {
      const body: Record<string, unknown> = {
        reviewId: activeReviewId,
        type: draft.type,
        severity: showSeverity ? draft.severity : null,
        body: draft.body.trim(),
        agentInstruction: '',
        // The real active Comparison, propagated from the Git context panel.
        comparisonSnapshotJson: JSON.stringify(comparisonDraft),
      };

      if (selectionInfo) {
        body.filePath = selectionInfo.filePath;
        body.side = selectionInfo.side;
        body.lineRangeStart = selectionInfo.startLine;
        body.lineRangeEnd = selectionInfo.endLine;

        // Compute real diff snapshot and SHA-256 hash from selected content
        const raw = selectionInfo.rawSnapshot || '';
        body.diffSnapshot = raw;

        // Compute SHA-256 hash in browser using Web Crypto API
        // Canonical format: filePath:side:startLine:LF-normalized-content
        const canonicalInput =
          selectionInfo.filePath +
          ':' +
          selectionInfo.side +
          ':' +
          String(selectionInfo.startLine) +
          ':' +
          raw.replace(/\r\n/g, '\n');

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalInput));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        body.contentHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }

      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/reviews/${activeReviewId}/observations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        draft.endSubmit(false, data.error ?? 'Failed to create observation');
        return;
      }

      draft.endSubmit(true);
      onCreated();
    } catch (e: unknown) {
      draft.endSubmit(false, e instanceof Error ? e.message : 'Failed to create observation');
    }
  }
</script>

<form class="obs-form" onsubmit={handleSubmit}>
  {#if draft.error}
    <div class="form-error" role="alert">{draft.error}</div>
  {/if}

  <div class="form-group">
    <Select id="obs-type" label="Type" bind:value={draft.type} disabled={draft.isSubmitting}>
      <option value="note">Note</option>
      <option value="issue">Issue</option>
      <option value="risk">Risk</option>
      <option value="suggestion">Suggestion</option>
      <option value="question">Question</option>
      <option value="praise">Praise</option>
    </Select>
  </div>

  {#if showSeverity}
    <div class="form-group">
      <label for="obs-severity">Severity</label>
      <select id="obs-severity" bind:value={draft.severity} disabled={draft.isSubmitting}>
        <option value={null}>-- Select severity --</option>
        <option value="critical">Critical</option>
        <option value="major">Major</option>
        <option value="minor">Minor</option>
        <option value="nitpick">Nitpick</option>
      </select>
    </div>
  {/if}

  <div class="form-group">
    <label for="obs-body">Body <span class="required">*</span></label>
    <textarea
      id="obs-body"
      bind:value={draft.body}
      maxlength="5000"
      rows="3"
      required
      disabled={draft.isSubmitting}
      placeholder="Observation body (1-5000 characters)"></textarea>
  </div>

  {#if selectionInfo}
    <div class="selection-info">
      Scope: {selectionInfo.filePath} lines {selectionInfo.startLine}-{selectionInfo.endLine} ({selectionInfo.side}
      side)
    </div>
  {/if}

  <div class="form-actions">
    <button type="submit" class="btn-primary" disabled={draft.isSubmitting || !draft.hasContent}>
      {draft.isSubmitting ? 'Creating...' : 'Create Observation'}
    </button>
    <button type="button" class="btn-secondary" onclick={onCancel} disabled={draft.isSubmitting}>
      Cancel
    </button>
  </div>
</form>
