import { describe, expect, it } from 'vitest';

import {
  ObservationOrigin,
  ObservationSeverity,
  ObservationType,
} from '$lib/server/domain/value-objects/observation-enums';

describe('ObservationType', () => {
  it('defines all six types', () => {
    expect(ObservationType.ISSUE).toBe('issue');
    expect(ObservationType.RISK).toBe('risk');
    expect(ObservationType.SUGGESTION).toBe('suggestion');
    expect(ObservationType.QUESTION).toBe('question');
    expect(ObservationType.PRAISE).toBe('praise');
    expect(ObservationType.NOTE).toBe('note');
  });
});

describe('ObservationSeverity', () => {
  it('defines severity levels', () => {
    expect(ObservationSeverity.CRITICAL).toBe('critical');
    expect(ObservationSeverity.MAJOR).toBe('major');
    expect(ObservationSeverity.MINOR).toBe('minor');
    expect(ObservationSeverity.NITPICK).toBe('nitpick');
  });
});

describe('ObservationOrigin', () => {
  it('defines human-only origin for stage 1', () => {
    expect(ObservationOrigin.HUMAN).toBe('human');
  });
});
