export interface FileSourceReaderReadParams {
  repositoryPath: string;
  relativePath: string;
  ref: string;
}

export interface SourceFileContent {
  content: string;
  isBinary: boolean;
  isDeleted: boolean;
  error?: {
    message: string;
    errorCode: string;
  };
}

export interface FileSourceReader {
  read(params: FileSourceReaderReadParams): Promise<SourceFileContent>;
}
