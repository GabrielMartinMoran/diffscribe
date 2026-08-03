import { describe, expect, it } from 'vitest';

import { ObservationDraftStore } from '$lib/web/stores/observation-draft-store.svelte';

describe('ObservationDraftStore state machine', () => {
  it('starts pristine with an empty draft', () => {
    const draft = new ObservationDraftStore();
    expect(draft.status).toBe('pristine');
    expect(draft.body).toBe('');
    expect(draft.type).toBe('note');
    expect(draft.severity).toBeNull();
    expect(draft.error).toBeNull();
  });

  it('marks the draft dirty when the body is edited and preserves the value', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    expect(draft.status).toBe('dirty');
    expect(draft.body).toBe('Draft body');
  });

  it('marks the draft dirty when type or severity change', () => {
    const draft = new ObservationDraftStore();
    draft.setType('issue');
    expect(draft.status).toBe('dirty');
    const other = new ObservationDraftStore();
    other.setSeverity('major');
    expect(other.status).toBe('dirty');
    expect(other.severity).toBe('major');
  });

  it('keeps pristine when setting the same value again', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('');
    expect(draft.status).toBe('pristine');
  });

  it('requestReplacement from pristine does not ask for confirmation', () => {
    const draft = new ObservationDraftStore();
    draft.requestReplacement();
    expect(draft.status).toBe('pristine');
  });

  it('requestReplacement from dirty enters the confirm state', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    draft.requestReplacement();
    expect(draft.status).toBe('confirm');
  });

  it('keepDraft returns to dirty and preserves the draft', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    draft.setType('risk');
    draft.requestReplacement();
    draft.keepDraft();
    expect(draft.status).toBe('dirty');
    expect(draft.body).toBe('Draft body');
    expect(draft.type).toBe('risk');
  });

  it('discardDraft clears the draft back to pristine', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    draft.setSeverity('minor');
    draft.requestReplacement();
    draft.discardDraft();
    expect(draft.status).toBe('pristine');
    expect(draft.body).toBe('');
    expect(draft.severity).toBeNull();
  });

  it('beginSubmit enters submitting; successful submit clears the draft', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    draft.beginSubmit();
    expect(draft.status).toBe('submitting');
    draft.endSubmit(true);
    expect(draft.status).toBe('pristine');
    expect(draft.body).toBe('');
    expect(draft.error).toBeNull();
  });

  it('failed submit returns to dirty with an inline error', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    draft.beginSubmit();
    draft.endSubmit(false, 'Something failed');
    expect(draft.status).toBe('dirty');
    expect(draft.error).toBe('Something failed');
    expect(draft.body).toBe('Draft body');
  });

  it('showError surfaces a missing-context error while keeping the draft dirty', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    draft.showError('Start a review before creating observations');
    expect(draft.status).toBe('dirty');
    expect(draft.error).toContain('review');
    expect(draft.body).toBe('Draft body');
  });

  it('reset clears error, values, and returns to pristine', () => {
    const draft = new ObservationDraftStore();
    draft.setBody('Draft body');
    draft.showError('boom');
    draft.reset();
    expect(draft.status).toBe('pristine');
    expect(draft.error).toBeNull();
    expect(draft.body).toBe('');
  });
});
