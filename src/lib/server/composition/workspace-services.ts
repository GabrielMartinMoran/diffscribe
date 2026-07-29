import type Database from 'better-sqlite3';

import type { FileSourceReader } from '$lib/server/application/file-source-reader';
import type { GitContextReader } from '$lib/server/application/git-context-reader';
import type { GitFileDiffReader } from '$lib/server/application/git-file-diff-reader';
import type { GitFileListReader } from '$lib/server/application/git-file-list-reader';
import type { GitValidator } from '$lib/server/application/git-validator';
import { CreateReviewUseCase } from '$lib/server/application/services/create-review-use-case';
import { DeleteWorkspaceUseCase } from '$lib/server/application/services/delete-workspace-use-case';
import { GetFileDiffUseCase } from '$lib/server/application/services/get-file-diff-use-case';
import { GetFileListUseCase } from '$lib/server/application/services/get-file-list-use-case';
import { GetFileSourceUseCase } from '$lib/server/application/services/get-file-source-use-case';
import { GetGitContextUseCase } from '$lib/server/application/services/get-git-context-use-case';
import { GetReviewUseCase } from '$lib/server/application/services/get-review-use-case';
import { GetWorkspaceTreeUseCase } from '$lib/server/application/services/get-workspace-tree-use-case';
import { GetWorkspaceUseCase } from '$lib/server/application/services/get-workspace-use-case';
import { ListReviewsUseCase } from '$lib/server/application/services/list-reviews-use-case';
import { ListWorkspacesUseCase } from '$lib/server/application/services/list-workspaces-use-case';
import {
  CreateObservationUseCase,
  DeleteObservationUseCase,
  GetObservationUseCase,
  ListObservationsUseCase,
  TransitionObservationStatusUseCase,
  UpdateObservationUseCase,
} from '$lib/server/application/services/observation-use-cases';
import { RegisterWorkspaceUseCase } from '$lib/server/application/services/register-workspace-use-case';
import { RenameWorkspaceUseCase } from '$lib/server/application/services/rename-workspace-use-case';
import { RepairWorkspacePathUseCase } from '$lib/server/application/services/repair-workspace-path-use-case';
import {
  CompleteReviewUseCase,
  MarkFileUseCase,
  UnmarkFileUseCase,
} from '$lib/server/application/services/review-actions-use-cases';
import { SetActiveReviewUseCase } from '$lib/server/application/services/set-active-review-use-case';
import type { WorkspaceTreeReader } from '$lib/server/application/workspace-tree-reader';
import { SimpleFileSourceReader } from '$lib/server/infrastructure/git/simple-file-source-reader';
import { SimpleGitContextReader } from '$lib/server/infrastructure/git/simple-git-context-reader';
import { SimpleGitFileDiffReader } from '$lib/server/infrastructure/git/simple-git-file-diff-reader';
import { SimpleGitFileListReader } from '$lib/server/infrastructure/git/simple-git-file-list-reader';
import { SimpleGitValidator } from '$lib/server/infrastructure/git/simple-git-validator';
import { SimpleWorkspaceTreeReader } from '$lib/server/infrastructure/git/simple-workspace-tree-reader';
import { SqliteAppStateRepository } from '$lib/server/infrastructure/repositories/sqlite-app-state-repository';
import { SqliteObservationRepository } from '$lib/server/infrastructure/repositories/sqlite-observation-repository';
import { SqliteReviewRepository } from '$lib/server/infrastructure/repositories/sqlite-review-repository';
import { SqliteWorkspaceRepository } from '$lib/server/infrastructure/repositories/sqlite-workspace-repository';
import { getHighlighter } from '$lib/server/infrastructure/shiki/highlighter';

export interface WorkspaceServices {
  registerUseCase: RegisterWorkspaceUseCase;
  listUseCase: ListWorkspacesUseCase;
  getUseCase: GetWorkspaceUseCase;
  repairUseCase: RepairWorkspacePathUseCase;
  renameUseCase: RenameWorkspaceUseCase;
  deleteUseCase: DeleteWorkspaceUseCase;
  getGitContextUseCase: GetGitContextUseCase;
  getFileListUseCase: GetFileListUseCase;
  getFileDiffUseCase: GetFileDiffUseCase;
  getFileSourceUseCase: GetFileSourceUseCase;
  getWorkspaceTreeUseCase: GetWorkspaceTreeUseCase;
  createReviewUseCase: CreateReviewUseCase;
  listReviewsUseCase: ListReviewsUseCase;
  getReviewUseCase: GetReviewUseCase;
  setActiveReviewUseCase: SetActiveReviewUseCase;
  markFileUseCase: MarkFileUseCase;
  unmarkFileUseCase: UnmarkFileUseCase;
  completeReviewUseCase: CompleteReviewUseCase;
  createObservationUseCase: CreateObservationUseCase;
  getObservationUseCase: GetObservationUseCase;
  listObservationsUseCase: ListObservationsUseCase;
  updateObservationUseCase: UpdateObservationUseCase;
  deleteObservationUseCase: DeleteObservationUseCase;
  transitionObservationStatusUseCase: TransitionObservationStatusUseCase;
  appState: SqliteAppStateRepository;
}

export function createWorkspaceServices(db: Database.Database): WorkspaceServices {
  const repository = new SqliteWorkspaceRepository(db);
  const appState = new SqliteAppStateRepository(db);
  const reviewRepository = new SqliteReviewRepository(db);
  const observationRepository = new SqliteObservationRepository(db);
  const gitValidator: GitValidator = new SimpleGitValidator();
  const gitContextReader: GitContextReader = new SimpleGitContextReader();
  const gitFileListReader: GitFileListReader = new SimpleGitFileListReader();
  const gitFileDiffReader: GitFileDiffReader = new SimpleGitFileDiffReader();
  const fileSourceReader: FileSourceReader = new SimpleFileSourceReader();
  const workspaceTreeReader: WorkspaceTreeReader = new SimpleWorkspaceTreeReader();

  return {
    registerUseCase: new RegisterWorkspaceUseCase(repository, gitValidator),
    listUseCase: new ListWorkspacesUseCase(repository, gitValidator),
    getUseCase: new GetWorkspaceUseCase(repository, gitValidator),
    repairUseCase: new RepairWorkspacePathUseCase(repository, gitValidator),
    renameUseCase: new RenameWorkspaceUseCase(repository),
    deleteUseCase: new DeleteWorkspaceUseCase(
      repository,
      appState,
      reviewRepository,
      observationRepository,
    ),
    getGitContextUseCase: new GetGitContextUseCase(gitContextReader),
    getFileListUseCase: new GetFileListUseCase(gitFileListReader),
    getFileDiffUseCase: new GetFileDiffUseCase(gitFileDiffReader, {
      highlight: async (code, lang) => {
        const h = await getHighlighter();
        return h.highlight(code, lang);
      },
    }),
    getFileSourceUseCase: new GetFileSourceUseCase(fileSourceReader, gitFileDiffReader, {
      highlight: async (code, lang) => {
        const h = await getHighlighter();
        return h.highlight(code, lang);
      },
    }),
    getWorkspaceTreeUseCase: new GetWorkspaceTreeUseCase(workspaceTreeReader),
    createReviewUseCase: new CreateReviewUseCase(reviewRepository, appState),
    listReviewsUseCase: new ListReviewsUseCase(reviewRepository, repository),
    getReviewUseCase: new GetReviewUseCase(reviewRepository),
    setActiveReviewUseCase: new SetActiveReviewUseCase(reviewRepository, appState),
    markFileUseCase: new MarkFileUseCase(reviewRepository),
    unmarkFileUseCase: new UnmarkFileUseCase(reviewRepository),
    completeReviewUseCase: new CompleteReviewUseCase(reviewRepository, appState),
    createObservationUseCase: new CreateObservationUseCase(observationRepository, reviewRepository),
    getObservationUseCase: new GetObservationUseCase(observationRepository, reviewRepository),
    listObservationsUseCase: new ListObservationsUseCase(observationRepository, reviewRepository),
    updateObservationUseCase: new UpdateObservationUseCase(observationRepository, reviewRepository),
    deleteObservationUseCase: new DeleteObservationUseCase(observationRepository, reviewRepository),
    transitionObservationStatusUseCase: new TransitionObservationStatusUseCase(
      observationRepository,
      reviewRepository,
    ),
    appState,
  };
}
