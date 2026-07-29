export enum ObservationType {
  ISSUE = 'issue',
  RISK = 'risk',
  SUGGESTION = 'suggestion',
  QUESTION = 'question',
  PRAISE = 'praise',
  NOTE = 'note',
}

export enum ObservationSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  NITPICK = 'nitpick',
}

export enum ObservationOrigin {
  HUMAN = 'human',
}

export enum ObservationStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
  PENDING = 'pending',
}
