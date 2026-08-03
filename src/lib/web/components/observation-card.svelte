<script lang="ts">
  import type { Component } from 'svelte';
  import {
    CircleAlert,
    CircleQuestionMark,
    Lightbulb,
    StickyNote,
    ThumbsUp,
    TriangleAlert,
  } from 'svelte-lucide';

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

  // Lucide icon per observation type: icon + text + color in one badge.
  const TYPE_ICONS: Record<string, Component> = {
    issue: CircleAlert,
    risk: TriangleAlert,
    suggestion: Lightbulb,
    question: CircleQuestionMark,
    praise: ThumbsUp,
    note: StickyNote,
  };

  const TypeIcon = $derived(TYPE_ICONS[observation.type] ?? StickyNote);

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
      <TypeIcon size={12} strokeWidth={2} aria-hidden="true" />
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
  </div>

  <div class="card-body">
    {observation.body.length > 200 ? observation.body.slice(0, 200) + '...' : observation.body}
  </div>

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
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
  }

  .obs-card:hover {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .obs-card.stale {
    border-color: var(--border-warning);
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
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: var(--radius-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-issue {
    background: var(--obs-type-issue-bg);
    color: var(--obs-type-issue-fg);
  }
  .badge-risk {
    background: var(--obs-type-risk-bg);
    color: var(--obs-type-risk-fg);
  }
  .badge-suggestion {
    background: var(--obs-type-suggestion-bg);
    color: var(--obs-type-suggestion-fg);
  }
  .badge-question {
    background: var(--obs-type-question-bg);
    color: var(--obs-type-question-fg);
  }
  .badge-praise {
    background: var(--obs-type-praise-bg);
    color: var(--obs-type-praise-fg);
  }
  .badge-note {
    background: var(--surface-secondary);
    color: var(--text-secondary);
  }
  .badge-stale {
    background: var(--obs-type-stale-bg);
    color: var(--obs-type-stale-fg);
  }

  .severity.sev-critical {
    background: var(--obs-sev-critical-bg);
    color: var(--obs-sev-critical-fg);
  }
  .severity.sev-major {
    background: var(--obs-sev-major-bg);
    color: var(--obs-sev-major-fg);
  }
  .severity.sev-minor {
    background: var(--obs-sev-minor-bg);
    color: var(--obs-sev-minor-fg);
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
    margin-left: auto;
  }
  .status-open {
    background: var(--obs-status-open);
  }
  .status-resolved {
    background: var(--obs-status-resolved);
  }
  .status-dismissed {
    background: var(--obs-status-dismissed);
  }
  .status-pending {
    background: var(--obs-status-pending);
  }

  .card-body {
    font-size: var(--text-xs);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
    line-height: 1.4;
    overflow-wrap: break-word;
    min-width: 0;
  }

  .card-meta {
    font-size: 11px;
    color: var(--text-tertiary);
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    min-width: 0;
  }

  .meta-file {
    font-family: var(--font-mono);
    overflow-wrap: break-word;
    min-width: 0;
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
    background: var(--text-error);
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
    font-family: var(--font-mono);
    font-size: 11px;
    white-space: pre-wrap;
    overflow-x: auto;
    max-height: 150px;
    overflow-y: auto;
  }
</style>
