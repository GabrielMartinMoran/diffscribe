import type { BadgeTone } from './ui/variants';

/**
 * Maps a git file status to the kit StatusBadge tone. The mapping is product
 * vocabulary living at the consumer layer; the kit itself stays generic.
 *
 * The technical status `untracked` renders with the success (green) tone so
 * "new" reads green; the technical/API/domain value remains `untracked`.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  added: 'success',
  modified: 'warning',
  deleted: 'error',
  renamed: 'info',
  copied: 'info',
  'type-changed': 'warning',
  unmerged: 'error',
  untracked: 'success',
  unknown: 'neutral',
};

export function statusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'neutral';
}

/**
 * Visible UI label for a git file status. The technical `untracked` status is
 * presented to the user as the English label `New`; no localization is
 * introduced. The API/domain value stays `untracked`.
 */
const STATUS_LABELS: Record<string, string> = {
  added: 'added',
  modified: 'modified',
  deleted: 'deleted',
  renamed: 'renamed',
  copied: 'copied',
  'type-changed': 'type changed',
  unmerged: 'unmerged',
  untracked: 'New',
  unknown: 'unknown',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
