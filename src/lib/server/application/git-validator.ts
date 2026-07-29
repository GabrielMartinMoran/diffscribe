export interface GitValidationResult {
  isValid: boolean;
  isRoot: boolean;
  error?: string;
}

export interface GitValidator {
  validate(repositoryPath: string): Promise<GitValidationResult>;
}
