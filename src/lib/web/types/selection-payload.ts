import type { SelectionKind } from '$lib/web/stores/observation-draft-store.svelte';

/**
 * Selection payload emitted by the diff viewer.
 *
 * `kind` distinguishes how the selection was made so the page shell can
 * decide whether the observation draft flow applies:
 * - `replace`: default click / L-key anchor — may switch to Comments and
 *   trigger the dirty-draft discard flow.
 * - `toggle`: Ctrl/Cmd-click — preserves the current draft.
 * - `extend`: Shift-click / Shift+Arrow — preserves the current draft.
 */
export interface SelectionPayload {
  filePath: string;
  side: string;
  startLine: number;
  endLine: number;
  rawSnapshot: string;
  kind: SelectionKind;
}
