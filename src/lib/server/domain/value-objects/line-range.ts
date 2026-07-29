export class LineRange {
  public readonly start: number;
  public readonly end: number;

  constructor(start: number, end: number) {
    if (typeof start !== 'number' || !Number.isInteger(start)) {
      throw new Error('startLine must be an integer');
    }
    if (typeof end !== 'number' || !Number.isInteger(end)) {
      throw new Error('endLine must be an integer');
    }
    if (start < 1) {
      throw new Error('startLine must be >= 1');
    }
    if (end < start) {
      throw new Error('endLine must be >= startLine');
    }
    this.start = start;
    this.end = end;
  }
}
