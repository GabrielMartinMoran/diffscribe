/**
 * Per-instance observation draft store.
 *
 * The Comments form unmounts when the user switches to the Review tab, so the
 * draft (body, type, severity) cannot live inside the form. The page shell
 * creates one instance of this store per workspace session and passes it down;
 * the draft survives tab switches.
 *
 * Explicit states:
 * - pristine:   no user edits yet (or a fresh draft)
 * - dirty:      the user edited the draft
 * - submitting: a create request is in flight
 * - confirm:    a replacement (new selection click) or Cancel asked whether
 *               to discard the dirty draft
 *
 * Selection kinds (see diff-viewer payload): only `replace` may trigger the
 * confirmation flow; `toggle` (Ctrl/Cmd) and `extend` (Shift) preserve the
 * draft untouched.
 */

export type DraftStatus = 'pristine' | 'dirty' | 'submitting' | 'confirm';

export type SelectionKind = 'replace' | 'toggle' | 'extend';

export class ObservationDraftStore {
  body = $state('');
  type = $state('note');
  severity = $state<string | null>(null);
  status = $state<DraftStatus>('pristine');
  error = $state<string | null>(null);

  get isDirty(): boolean {
    return this.status === 'dirty';
  }

  get isConfirming(): boolean {
    return this.status === 'confirm';
  }

  get isSubmitting(): boolean {
    return this.status === 'submitting';
  }

  get hasContent(): boolean {
    return this.body.trim().length > 0;
  }

  // ── User edits: pristine → dirty ──

  /** Form bindings promote pristine → dirty when the user edits. */
  markEdited(): void {
    if (this.status === 'pristine') this.status = 'dirty';
  }

  setBody(value: string): void {
    if (value === this.body) return;
    this.body = value;
    if (this.status === 'pristine') this.status = 'dirty';
  }

  setType(value: string): void {
    if (value === this.type) return;
    this.type = value;
    if (this.status === 'pristine') this.status = 'dirty';
  }

  setSeverity(value: string | null): void {
    if (value === this.severity) return;
    this.severity = value;
    if (this.status === 'pristine') this.status = 'dirty';
  }

  // ── Replacement / confirmation flow ──

  requestReplacement(): void {
    if (this.status === 'dirty') this.status = 'confirm';
  }

  keepDraft(): void {
    if (this.status === 'confirm') this.status = 'dirty';
  }

  discardDraft(): void {
    this.reset();
  }

  // ── Submit flow ──

  beginSubmit(): void {
    this.status = 'submitting';
    this.error = null;
  }

  endSubmit(success: boolean, message?: string): void {
    if (success) {
      this.reset();
    } else {
      this.status = 'dirty';
      this.error = message ?? 'Failed to create observation';
    }
  }

  /** Missing context (no active review / no comparison): inline error. */
  showError(message: string): void {
    this.status = 'dirty';
    this.error = message;
  }

  reset(): void {
    this.body = '';
    this.type = 'note';
    this.severity = null;
    this.status = 'pristine';
    this.error = null;
  }
}
