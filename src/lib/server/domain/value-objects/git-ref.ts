export type GitRefType = 'branch' | 'commit' | 'head' | 'working-tree' | 'index';

const VALID_TYPES: GitRefType[] = ['branch', 'commit', 'head', 'working-tree', 'index'];

export type GitRefSerialized = {
  type: GitRefType;
  value: string;
  label: string;
};

export class GitRef {
  public readonly type: GitRefType;
  public readonly value: string;

  constructor(type: GitRefType, value: string) {
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Invalid GitRefType: "${type}"`);
    }
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error('GitRef value must be a non-empty string');
    }
    this.type = type;
    this.value = value;
  }

  equals(other: GitRef): boolean {
    return this.type === other.type && this.value === other.value;
  }

  toJSON(): GitRefSerialized {
    return {
      type: this.type,
      value: this.value,
      label: this.type === 'working-tree' ? 'working tree' : this.value,
    };
  }
}
