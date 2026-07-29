<script lang="ts">
  import type { ObservationResult } from '$lib/web/stores/observation-store';

  let {
    observation,
    staleStatus = null as string | null,
    readOnly = false,
    onEdit = (_id: string) => {
      void _id;
    },
    onDelete = (_id: string) => {
      void _id;
    },
    onStatusChange = (_id: string, _status: string) => {
      void _id;
      void _status;
    },
  }: {
    observation: ObservationResult;
    staleStatus: string | null;
    readOnly: boolean;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
  } = $props();

  function badgeClass(type: string): string {
    switch (type) {
      case 'issue':
        return 'badge-issue';
      case 'risk':
        return 'badge-risk';
      case 'suggestion':
        return 'badge-suggestion';
      case 'question':
        return 'badge-question';
      case 'praise':
        return 'badge-praise';
      default:
        return 'badge-note';
    }
  }

  function severityBadgeClass(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'sev-critical';
      case 'major':
        return 'sev-major';
      case 'minor':
        return 'sev-minor';
      default:
        return 'sev-nitpick';
    }
  }
</script>

<div class="obs-card" class:stale={!!staleStatus}>
  <div class="card-header">
    <span class="badge {badgeClass(observation.type)}">
      {observation.type}
    </span>
    {#if observation.severity}
      <span class="badge severity {severityBadgeClass(observation.severity)}">
        {observation.severity}
      </span>
    {/if}
    {#if staleStatus}
      <span class="badge badge-stale" title={staleStatus}>Stale</span>
    {/if}
    <span class="status-dot status-{observation.status}"></span>
    <span
      class="card-title"
      role="button"
      tabindex="0"
      onclick={() => onEdit(observation.id)}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(observation.id);
        }
      }}
    >
      {observation.title}
    </span>
  </div>

  {#if observation.body}
    <div class="card-body">
      {observation.body.length > 200 ? observation.body.slice(0, 200) + '...' : observation.body}
    </div>
  {/if}

  <div class="card-meta">
    {#if observation.filePath}
      <span class="meta-file"
        >{observation.filePath}{observation.lineStart
          ? ` :${observation.lineStart}`
          : ''}{observation.lineEnd && observation.lineEnd !== observation.lineStart
          ? `-${observation.lineEnd}`
          : ''}</span
      >
    {/if}
    <span class="meta-date">{new Date(observation.createdAt).toLocaleDateString()}</span>
  </div>

  {#if !readOnly}
    <div class="card-actions">
      <button onclick={() => onEdit(observation.id)} aria-label="Edit">Edit</button>
      {#if observation.status === 'open'}
        <button onclick={() => onStatusChange(observation.id, 'resolved')} aria-label="Resolve"
          >Resolve</button
        >
        <button onclick={() => onStatusChange(observation.id, 'dismissed')} aria-label="Dismiss"
          >Dismiss</button
        >
        <button onclick={() => onStatusChange(observation.id, 'pending')} aria-label="Pending"
          >Pending</button
        >
      {:else}
        <button onclick={() => onStatusChange(observation.id, 'open')} aria-label="Reopen"
          >Reopen</button
        >
      {/if}
      <button class="danger" onclick={() => onDelete(observation.id)} aria-label="Delete"
        >Delete</button
      >
    </div>
  {/if}

  {#if staleStatus && observation.diffSnapshot}
    <details class="card-snapshot">
      <summary>Original snapshot</summary>
      <pre class="snapshot-content">{observation.diffSnapshot}</pre>
    </details>
  {/if}
</div>

<style>
  .obs-card {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    margin-bottom: var(--space-2);
    background: var(--surface-primary);
    transition: box-shadow 0.15s;
  }

  .obs-card:hover {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .obs-card.stale {
    border-color: var(--border-warning, #ff9800);
  }

  .obs-card:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
    margin-bottom: var(--space-1);
  }

  .badge {
    display: inline-block;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: var(--radius-xs, 3px);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-issue {
    background: #fce4ec;
    color: #c62828;
  }
  .badge-risk {
    background: #fff3e0;
    color: #e65100;
  }
  .badge-suggestion {
    background: #e8f5e9;
    color: #2e7d32;
  }
  .badge-question {
    background: #e3f2fd;
    color: #1565c0;
  }
  .badge-praise {
    background: #f3e5f5;
    color: #6a1b9a;
  }
  .badge-note {
    background: var(--surface-secondary);
    color: var(--text-secondary);
  }
  .badge-stale {
    background: #fff8e1;
    color: #f57f17;
  }

  .severity.sev-critical {
    background: #ffcdd2;
    color: #b71c1c;
  }
  .severity.sev-major {
    background: #ffe0b2;
    color: #e65100;
  }
  .severity.sev-minor {
    background: #fff9c4;
    color: #f57f17;
  }
  .severity.sev-nitpick {
    background: var(--surface-secondary);
    color: var(--text-secondary);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-open {
    background: #4caf50;
  }
  .status-resolved {
    background: #2196f3;
  }
  .status-dismissed {
    background: #9e9e9e;
  }
  .status-pending {
    background: #ff9800;
  }

  .card-title {
    font-weight: 500;
    font-size: var(--text-sm);
    cursor: pointer;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-body {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    margin-bottom: var(--space-1);
    line-height: 1.4;
  }

  .card-meta {
    font-size: 11px;
    color: var(--text-tertiary);
    display: flex;
    gap: var(--space-2);
  }

  .meta-file {
    font-family: var(--font-mono, monospace);
  }

  .card-actions {
    display: none;
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-subtle);
    gap: var(--space-1);
    flex-wrap: wrap;
  }

  .obs-card:hover .card-actions,
  .obs-card:focus-within .card-actions {
    display: flex;
  }

  .card-actions button {
    padding: 2px 8px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-xs);
    background: var(--surface-secondary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 11px;
  }

  .card-actions button:hover {
    background: var(--accent);
    color: var(--text-inverse);
  }

  .card-actions button.danger:hover {
    background: var(--text-error, #d32f2f);
    color: white;
  }

  .card-snapshot {
    margin-top: var(--space-2);
    font-size: var(--text-xs);
  }

  .card-snapshot summary {
    cursor: pointer;
    color: var(--text-secondary);
  }

  .snapshot-content {
    margin-top: var(--space-1);
    padding: var(--space-2);
    background: var(--surface-secondary);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    white-space: pre-wrap;
    overflow-x: auto;
    max-height: 150px;
    overflow-y: auto;
  }
</style>
