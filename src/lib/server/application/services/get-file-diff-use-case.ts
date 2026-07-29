import type { FileDiffResult } from '$lib/server/application/dto/results/file-diff-results';
import type { GitFileDiffReader } from '$lib/server/application/git-file-diff-reader';
import type { ComparisonType } from '$lib/server/domain/value-objects/comparison';
import type { DiffHighlighter } from '$lib/server/infrastructure/shiki/highlighter';
import { resolveLanguage } from '$lib/server/infrastructure/shiki/language-map';

export interface GetFileDiffParams {
  comparisonType: ComparisonType;
  baseRef: string;
  targetRef: string;
}

export class GetFileDiffUseCase {
  constructor(
    private readonly reader: GitFileDiffReader,
    private readonly highlighter: DiffHighlighter,
  ) {}

  async execute(
    repositoryPath: string,
    relativePath: string,
    params: GetFileDiffParams,
  ): Promise<FileDiffResult> {
    const result = await this.reader.read({
      repositoryPath,
      comparisonType: params.comparisonType,
      baseRef: params.baseRef,
      targetRef: params.targetRef,
      relativePath,
    });

    // If the result has an error, return it as-is
    if (result.error || result.isBinary || result.hunks.length === 0) {
      return result;
    }

    // Resolve language for highlighting
    const lang = resolveLanguage(relativePath);

    // Highlight context and added lines
    const highlightedHunks = await Promise.all(
      result.hunks.map(async (hunk) => {
        const highlightedLines = await Promise.all(
          hunk.lines.map(async (line) => {
            if (line.changeType === 'context' || line.changeType === 'added') {
              const highlighted = await this.highlighter.highlight(line.content, lang);
              const firstLine = highlighted.lines[0];
              return {
                ...line,
                html: firstLine?.html ?? '',
                text: firstLine?.text ?? line.content,
              };
            }
            // Deleted lines: plain text, no highlighting
            return {
              ...line,
              html: '',
              text: line.content,
            };
          }),
        );

        return { ...hunk, lines: highlightedLines };
      }),
    );

    return { ...result, hunks: highlightedHunks };
  }
}
