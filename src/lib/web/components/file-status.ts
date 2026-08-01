import type { BadgeTone } from './ui/variants';

/**
 * Maps a git file status to the kit StatusBadge tone. The mapping is product
 * vocabulary living at the consumer layer; the kit itself stays generic.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  added: 'success',
  modified: 'warning',
  deleted: 'error',
  renamed: 'info',
  copied: 'info',
  'type-changed': 'warning',
  unmerged: 'error',
  untracked: 'neutral',
  unknown: 'neutral',
};

export function statusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'neutral';
}
