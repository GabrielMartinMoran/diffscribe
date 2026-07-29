/**
 * Client-safe comparison draft that matches ComparisonSerialized from the server.
 *
 * This type avoids duplicating inline ComparisonDraft interfaces across
 * multiple components (diff-viewer, git-context-panel, project-tree,
 * source-viewer). It is intentionally a plain interface (no Zod, no class)
 * because it crosses the HTTP boundary as raw JSON.
 */
export interface ComparisonDraft {
  base: { type: string; value: string; label: string };
  target: { type: string; value: string; label: string };
  comparisonType: string;
  createdAt: string;
}
