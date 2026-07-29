import type { FileDiffResult } from '$lib/server/application/dto/results/file-diff-results';
import type {
  FileSourceResult,
  SourceChangeType,
  SourceLine,
} from '$lib/server/application/dto/results/file-source-results';
import type { FileSourceReader } from '$lib/server/application/file-source-reader';
import type { GitFileDiffReader } from '$lib/server/application/git-file-diff-reader';
import type { ComparisonType } from '$lib/server/domain/value-objects/comparison';
import type { DiffHighlighter } from '$lib/server/infrastructure/shiki/highlighter';
import { resolveLanguage } from '$lib/server/infrastructure/shiki/language-map';

export interface GetFileSourceParams {
  comparisonType: ComparisonType;
  baseRef: string;
  targetRef: string;
}

const MAX_SIZE_BYTES = 256 * 1024; // 256 KB
const MAX_LINES = 5000;

function deriveLineMarkers(diff: FileDiffResult): Map<number, SourceChangeType> {
  const markers = new Map<number, SourceChangeType>();

  for (const hunk of diff.hunks) {
    // Collect lines grouped by non-context blocks
    let minusCount = 0;
    const addedLines: { newLineNumber: number }[] = [];

    for (const line of hunk.lines) {
      if (line.changeType === 'deleted') {
        minusCount++;
      } else if (line.changeType === 'added') {
        addedLines.push({ newLineNumber: line.newLineNumber });
      } else if (line.changeType === 'context') {
        // End of current changed block: flush added lines
        // First `minusCount` added lines are modifications, rest are additions
        for (let i = 0; i < addedLines.length; i++) {
          const marker: SourceChangeType = i < minusCount ? 'modified' : 'added';
          markers.set(addedLines[i].newLineNumber, marker);
        }
        addedLines.length = 0;
        minusCount = 0;

        // Context lines are unchanged in the target
        markers.set(line.newLineNumber, 'unchanged');
      }
    }

    // Flush remaining block at end of hunk
    for (let i = 0; i < addedLines.length; i++) {
      const marker: SourceChangeType = i < minusCount ? 'modified' : 'added';
      markers.set(addedLines[i].newLineNumber, marker);
    }
  }

  return markers;
}

interface SizeCapResult {
  lines: SourceLine[];
  isTruncated: boolean;
  truncationReason?: string;
}

function applySizeCap(sourceLines: SourceLine[]): SizeCapResult {
  let totalBytes = 0;
  const capped: SourceLine[] = [];

  for (const line of sourceLines) {
    const lineBytes = Buffer.byteLength(line.content, 'utf-8');

    if (totalBytes + lineBytes > MAX_SIZE_BYTES) {
      return {
        lines: capped,
        isTruncated: true,
        truncationReason: 'Content exceeds 256 KB',
      };
    }

    if (capped.length >= MAX_LINES) {
      return {
        lines: capped,
        isTruncated: true,
        truncationReason: 'Content exceeds 5000 lines',
      };
    }

    capped.push(line);
    totalBytes += lineBytes;
  }

  return { lines: capped, isTruncated: false };
}

export class GetFileSourceUseCase {
  constructor(
    private readonly sourceReader: FileSourceReader,
    private readonly diffReader: GitFileDiffReader,
    private readonly highlighter: DiffHighlighter,
  ) {}

  async execute(
    repositoryPath: string,
    relativePath: string,
    params: GetFileSourceParams,
  ): Promise<FileSourceResult> {
    const now = new Date().toISOString();
    const lang = resolveLanguage(relativePath);

    // 1. Read source content from the target
    const source = await this.sourceReader.read({
      repositoryPath,
      relativePath,
      ref: params.targetRef,
    });

    if (source.error) {
      return {
        path: relativePath,
        language: lang,
        lines: [],
        isBinary: false,
        isTruncated: false,
        isDeleted: source.isDeleted,
        readAt: now,
        error: source.error,
      };
    }

    if (source.isBinary) {
      return {
        path: relativePath,
        language: lang,
        lines: [],
        isBinary: true,
        isTruncated: false,
        isDeleted: false,
        readAt: now,
      };
    }

    // 2. Get diff for line markers
    const diffResult = await this.diffReader.read({
      repositoryPath,
      comparisonType: params.comparisonType,
      baseRef: params.baseRef,
      targetRef: params.targetRef,
      relativePath,
    });

    // 3. Derive line markers from the diff
    const markers = deriveLineMarkers(diffResult);

    // 4. Highlight the entire source content
    const highlighted = await this.highlighter.highlight(source.content, lang);

    // 5. Build source lines with markers and highlighting
    const contentLines = source.content.split('\n');
    const sourceLines: SourceLine[] = contentLines.map((content, index) => {
      const lineNumber = index + 1;
      const changeType = markers.has(lineNumber) ? markers.get(lineNumber) : 'unchanged';
      const hlLine = highlighted.lines[index];
      return {
        lineNumber,
        content,
        changeType: changeType!,
        html: hlLine?.html ?? '',
        text: hlLine?.text ?? content,
      };
    });

    // 6. Apply size cap
    const { lines, isTruncated, truncationReason } = applySizeCap(sourceLines);

    return {
      path: relativePath,
      language: lang,
      lines,
      isBinary: false,
      isTruncated,
      truncationReason,
      isDeleted: false,
      readAt: now,
    };
  }
}
