<script lang="ts">
  import type { SelectionInfo } from '$lib/web/stores/observation-store';

  let {
    activeWorkspaceId,
    activeReviewId,
    selectionInfo = null as SelectionInfo | null,
    onCreated = () => {},
    onCancel = () => {},
  }: {
    activeWorkspaceId: string | null;
    activeReviewId: string | null;
    selectionInfo: SelectionInfo | null;
    onCreated: () => void;
    onCancel: () => void;
  } = $props();

  let obsType = $state('note');
  let obsSeverity = $state<string | null>(null);
  let obsTitle = $state('');
  let obsBody = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  // Show severity selector only for issue/risk
  let showSeverity = $derived(obsType === 'issue' || obsType === 'risk');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!obsTitle.trim() || !activeWorkspaceId || !activeReviewId) return;

    submitting = true;
    error = null;

    try {
      const body: Record<string, unknown> = {
        reviewId: activeReviewId,
        type: obsType,
        severity: showSeverity ? obsSeverity : null,
        title: obsTitle.trim(),
        body: obsBody.trim(),
        agentInstruction: '',
        comparisonSnapshotJson: JSON.stringify({
          base: { type: 'head', value: 'HEAD', label: 'HEAD' },
          target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
          comparisonType: 'working-tree-vs-head',
          createdAt: new Date().toISOString(),
        }),
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
        error = data.error ?? 'Failed to create observation';
        return;
      }

      obsTitle = '';
      obsBody = '';
      obsType = 'note';
      obsSeverity = null;
      onCreated();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to create observation';
    } finally {
      submitting = false;
    }
  }
</script>

<form class="obs-form" onsubmit={handleSubmit}>
  {#if error}
    <div class="form-error" role="alert">{error}</div>
  {/if}

  <div class="form-group">
    <label for="obs-type">Type</label>
    <select id="obs-type" bind:value={obsType} disabled={submitting}>
      <option value="note">Note</option>
      <option value="issue">Issue</option>
      <option value="risk">Risk</option>
      <option value="suggestion">Suggestion</option>
      <option value="question">Question</option>
      <option value="praise">Praise</option>
    </select>
  </div>

  {#if showSeverity}
    <div class="form-group">
      <label for="obs-severity">Severity</label>
      <select id="obs-severity" bind:value={obsSeverity} disabled={submitting}>
        <option value={null}>-- Select severity --</option>
        <option value="critical">Critical</option>
        <option value="major">Major</option>
        <option value="minor">Minor</option>
        <option value="nitpick">Nitpick</option>
      </select>
    </div>
  {/if}

  <div class="form-group">
    <label for="obs-title">Title <span class="required">*</span></label>
    <input
      id="obs-title"
      type="text"
      bind:value={obsTitle}
      maxlength="200"
      required
      disabled={submitting}
      placeholder="Observation title (1-200 characters)"
    />
  </div>

  <div class="form-group">
    <label for="obs-body">Body</label>
    <textarea
      id="obs-body"
      bind:value={obsBody}
      maxlength="5000"
      rows="3"
      disabled={submitting}
      placeholder="Optional details (up to 5000 characters)"></textarea>
  </div>

  {#if selectionInfo}
    <div class="selection-info">
      Scope: {selectionInfo.filePath} lines {selectionInfo.startLine}-{selectionInfo.endLine} ({selectionInfo.side}
      side)
    </div>
  {/if}

  <div class="form-actions">
    <button type="submit" class="btn-primary" disabled={submitting || !obsTitle.trim()}>
      {submitting ? 'Creating...' : 'Create Observation'}
    </button>
    <button type="button" class="btn-secondary" onclick={onCancel} disabled={submitting}>
      Cancel
    </button>
  </div>
</form>

<style>
  .obs-form {
    padding: var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-secondary);
    margin-bottom: var(--space-3);
  }

  .form-error {
    padding: var(--space-2);
    margin-bottom: var(--space-2);
    background: var(--surface-error, #fce4ec);
    border: 1px solid var(--text-error, #d32f2f);
    border-radius: var(--radius-sm);
    color: var(--text-error, #d32f2f);
    font-size: var(--text-sm);
  }

  .form-group {
    margin-bottom: var(--space-2);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--space-1);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
  }

  .required {
    color: var(--text-error, #d32f2f);
  }

  .form-group select,
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-family: inherit;
    background: var(--surface-primary);
    color: var(--text-primary);
  }

  .selection-info {
    padding: var(--space-2);
    margin-bottom: var(--space-2);
    background: var(--selection-bg, rgba(66, 133, 244, 0.1));
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .form-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .btn-primary {
    padding: var(--space-1) var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--text-inverse);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--text-sm);
  }
</style>
