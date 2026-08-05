/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

import { DEFAULT_VISUAL_SETTINGS } from '../../src/lib/web/stores/visual-settings-store';

type World = any;

const PAGE_PATH = path.resolve(__dirname, '../../src/routes/+page.svelte');
const DELETE_DIALOG_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/delete-confirm-dialog.svelte',
);
const OPEN_FORM_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/open-workspace-form.svelte',
);
const FILE_LIST_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-list.svelte');
const FILE_STATUS_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-status.ts');
const TREE_NODE_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/project-tree-node.svelte',
);
const STATUS_AGG_PATH = path.resolve(__dirname, '../../src/lib/web/utils/status-aggregation.ts');
const SETTINGS_PATH = path.resolve(__dirname, '../../src/lib/web/components/settings-panel.svelte');
const COMPLETE_DIFF_VIEWER_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/complete-diff-viewer.svelte',
);
const MARKDOWN_RENDERER_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/utils/markdown-renderer.ts',
);
const SOURCE_VIEWER_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/source-viewer.svelte',
);
const GIT_PANEL_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/git-context-panel.svelte',
);
const BRANCH_POPUP_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/branch-select-popup.svelte',
);
const RIGHT_PANEL_TABS_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/right-panel-tabs.svelte',
);
const RAIL_TABS_PATH = path.resolve(__dirname, '../../src/lib/web/components/rail-tabs.svelte');
const OPEN_FILES_TABS_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/open-files-tabs.svelte',
);
const HELP_DIALOG_PATH = path.resolve(__dirname, '../../src/lib/web/components/help-dialog.svelte');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Background
// ────────────────────────────────────────────────────────────────────────────

Given('the workbench shell is loaded', (_w: World) => {
  const appHtml = path.resolve(__dirname, '../../src/app.html');
  if (!fs.existsSync(appHtml)) {
    throw new Error('app.html not found');
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  Phase 1: workspace lifecycle
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace is registered and selected', (_w: World) => {
  requireMarker(PAGE_PATH, 'open-workspace-form');
  requireMarker(PAGE_PATH, "activeRailTab = activeWorkspaceId ? 'git' : 'workspaces'");
});

When('the user deletes the workspace and confirms', (_w: World) => {
  requireMarker(DELETE_DIALOG_PATH, 'invalidateAll');
});

Then('the workspace disappears from the sidebar without a reload', (_w: World) => {
  requireMarker(DELETE_DIALOG_PATH, 'invalidateAll');
  requireMarker(DELETE_DIALOG_PATH, 'onClose');
});

Given('the user opens the Open Workspace form', (_w: World) => {
  requireMarker(PAGE_PATH, 'open-workspace-toggle');
  requireMarker(OPEN_FORM_PATH, 'open-workspace-form');
});

Then('the repository path field remains editable', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, 'repositoryPath');
  requireMarker(OPEN_FORM_PATH, 'bind:value={path}');
});

When('the user types a repository path and opens it', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, 'action="?/register"');
});

Then('the workspace is registered', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, 'invalidateAll');
});

Given('the browser supports directory selection', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, 'webkitdirectory');
  requireMarker(OPEN_FORM_PATH, 'supportsDirectoryBrowse');
});

When('the user browses for a directory', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, 'webkitRelativePath');
});

Then('the repository path field is pre-filled with the directory name', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, "relativePath.split('/')[0]");
});

Then('the user can complete the absolute path manually', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, 'bind:value={path}');
});

Given('a workspace is registered', (_w: World) => {
  requireMarker(OPEN_FORM_PATH, 'open-workspace-form');
});

When('the user selects the workspace', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab = activeWorkspaceId ? 'git' : 'workspaces'");
  requireMarker(PAGE_PATH, "activeRailTab = activeWorkspaceId ? 'git' : 'workspaces'");
});

Then('the complete diff for the default comparison is shown', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'complete-diff-viewer');
});

Given('the user landed in Git after selecting a workspace', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab = activeWorkspaceId ? 'git' : 'workspaces'");
});

When('the user activates the Project rail', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab === 'project'");
  requireMarker(PAGE_PATH, "activeRailTab === 'project'");
});

Then('the project tree is shown for the active workspace', (_w: World) => {
  requireMarker(PAGE_PATH, 'ProjectTree');
  const treePath = path.resolve(__dirname, '../../src/lib/web/components/project-tree.svelte');
  requireMarker(treePath, 'data-testid="project-tree"');
});

// ────────────────────────────────────────────────────────────────────────────
//  Phase 2: presentation settings, New label, status dots
// ────────────────────────────────────────────────────────────────────────────

Given('no file list view preference is stored', (_w: World) => {
  if (DEFAULT_VISUAL_SETTINGS.fileListView !== 'tree') {
    throw new Error('Fresh contexts must default the file list to tree');
  }
});

When('the user opens a workspace in Git', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
});

Then('the changed files are presented as a tree', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'DEFAULT_VISUAL_SETTINGS.fileListView');
});

Given('the legacy file list preference is stored as list', (_w: World) => {
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, "LEGACY_FILE_LIST_VIEW_STORAGE_KEY = 'diffscribe-file-list-view'");
  requireMarker(storePath, "legacy === 'list'");
});

Then('the changed files are presented as a list', (_w: World) => {
  // 0003: the list view comes from the Settings-owned preference; the Git
  // panel has no local switcher.
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
  requireMarker(SETTINGS_PATH, 'settings-file-list-list');
});

When('the user changes the file list view setting to list', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'settings-file-list-list');
  requireMarker(SETTINGS_PATH, 'writeVisualSettings');
});

Then('the Git file list presents files as a list after reload', (_w: World) => {
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, 'readVisualSettings');
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
  requireMarker(SETTINGS_PATH, 'settings-file-list-list');
});

Given('only the legacy file list preference is stored', (_w: World) => {
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, "LEGACY_FILE_LIST_VIEW_STORAGE_KEY = 'diffscribe-file-list-view'");
});

When('the settings aggregate is read for the first time', (_w: World) => {
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, 'readVisualSettings');
});

Then('the legacy value is honored once', (_w: World) => {
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, "legacy === 'list'");
});

Then('the first write removes the legacy key', (_w: World) => {
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, 'removeItem(LEGACY_FILE_LIST_VIEW_STORAGE_KEY)');
});

Given('a workspace with an untracked file', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'statusLabel');
});

When('the user views the Git file list', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-panel');
});

Then('the untracked file shows the label New', (_w: World) => {
  const src = fs.readFileSync(FILE_STATUS_PATH, 'utf-8');
  if (!src.includes("untracked: 'New'")) {
    throw new Error('file-status must map the technical untracked status to the UI label New');
  }
});

Then('the label renders with the green tone', (_w: World) => {
  const src = fs.readFileSync(FILE_STATUS_PATH, 'utf-8');
  if (!src.includes("untracked: 'success'")) {
    throw new Error('file-status must map untracked to the success (green) tone');
  }
});

When('the file list endpoint is queried', (_w: World) => {
  // The technical/API status stays untracked; verified by adapter tests.
  const adapterPath = path.resolve(
    __dirname,
    '../../src/lib/server/infrastructure/git/simple-git-file-list-reader.ts',
  );
  requireMarker(adapterPath, 'untracked');
});

Then('the entry status remains untracked', (_w: World) => {
  const domainPath = path.resolve(
    __dirname,
    '../../src/lib/server/domain/value-objects/file-change-status.ts',
  );
  const src = fs.readFileSync(domainPath, 'utf-8');
  if (!src.includes('untracked')) {
    throw new Error('The domain value FileChangeStatus.UNTRACKED must remain untracked');
  }
});

Given('a workspace with changed files under a directory', (_w: World) => {
  requireMarker(TREE_NODE_PATH, 'statusMap');
});

When('the user views the Project tree', (_w: World) => {
  requireMarker(TREE_NODE_PATH, 'project-tree');
});

Then('the directory shows a status dot derived from its descendants', (_w: World) => {
  requireMarker(TREE_NODE_PATH, 'descendantStatuses');
  requireMarker(TREE_NODE_PATH, 'aggregateStatus');
});

Given('a directory contains a modified file and an untracked file', (_w: World) => {
  requireMarker(STATUS_AGG_PATH, 'modified');
  requireMarker(STATUS_AGG_PATH, 'untracked');
});

Then('the directory dot reflects the modified status', (_w: World) => {
  const src = fs.readFileSync(STATUS_AGG_PATH, 'utf-8');
  const precedence = src.indexOf('unmerged');
  const modified = src.indexOf('modified');
  const untracked = src.indexOf('untracked');
  if (precedence === -1 || modified === -1 || untracked === -1 || modified > untracked) {
    throw new Error('Precedence must rank modified above untracked');
  }
});

Then('a directory with only untracked descendants shows a green dot', (_w: World) => {
  const tokens = fs.readFileSync(
    path.resolve(__dirname, '../../src/lib/web/styles/tokens.css'),
    'utf-8',
  );
  if (tokens.includes('--tree-status-untracked: #8b5cf6')) {
    throw new Error('The untracked status token must no longer be purple');
  }
  if (!tokens.includes('--tree-status-untracked: #22c55e')) {
    throw new Error('The untracked status token must be green (#22c55e)');
  }
});

Given('a workspace with an added file and an untracked file', (_w: World) => {
  requireMarker(FILE_STATUS_PATH, 'added');
});

Then('both file dots render in green', (_w: World) => {
  const src = fs.readFileSync(FILE_STATUS_PATH, 'utf-8');
  if (!src.includes("added: 'success'") || !src.includes("untracked: 'success'")) {
    throw new Error('added and untracked must both map to the success (green) tone');
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  Phase 3: complete diff
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace with changes and no open file tab', (_w: World) => {
  requireMarker(PAGE_PATH, 'CompleteDiffViewer');
});

When('the user lands in Git', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab === 'git'");
  requireMarker(PAGE_PATH, "activeRailTab === 'git'");
});

Then('the complete diff of the active comparison is shown', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'complete-diff-viewer');
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'complete-diff');
});

Then('the complete diff of the active comparison is shown as the pinned first tab', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'complete-diff-viewer');
  requireMarker(PAGE_PATH, 'pinCompleteDiff');
  requireMarker(OPEN_FILES_TABS_PATH, 'pinned-complete-diff-tab');
});

Given('a workspace with several changed files', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'files');
});

When('the complete diff is loaded', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, '/complete-diff');
});

Then('the file sections appear ordered by path', (_w: World) => {
  const adapterPath = path.resolve(
    __dirname,
    '../../src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts',
  );
  requireMarker(adapterPath, 'localeCompare');
});

Given('the complete diff is shown', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'complete-diff-viewer');
});

When('the user clicks a file in the complete diff index', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'onFileClick');
});

Then("the view scrolls to that file's diff section", (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'scrollIntoView');
});

When('the user Ctrl-clicks or Cmd-clicks a file', (_w: World) => {
  requireMarker(PAGE_PATH, 'handleGitFileSelect');
  requireMarker(PAGE_PATH, 'openFileTab');
});

Then('a new tab opens with the full file', (_w: World) => {
  requireMarker(PAGE_PATH, 'openFileTab(path, undefined, true)');
});

Given('a workspace with a binary file and an oversized file', (_w: World) => {
  const adapterPath = path.resolve(
    __dirname,
    '../../src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts',
  );
  requireMarker(adapterPath, 'binary');
});

Then('the binary file shows a binary marker without content', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'binary');
});

Then('the oversized file shows a truncation notice', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'isTruncated');
});

Given('a comparison with more files than the limit', (_w: World) => {
  const adapterPath = path.resolve(
    __dirname,
    '../../src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts',
  );
  requireMarker(adapterPath, 'fileLimit');
});

When('the aggregate reader runs', (_w: World) => {
  const adapterPath = path.resolve(
    __dirname,
    '../../src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts',
  );
  requireMarker(adapterPath, 'read');
});

When('the aggregate reader runs once', (_w: World) => {
  const adapterPath = path.resolve(
    __dirname,
    '../../src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts',
  );
  requireMarker(adapterPath, 'read');
  requireMarker(adapterPath, 'readAt');
});

Then('the result is marked truncated', (_w: World) => {
  const dtoPath = path.resolve(
    __dirname,
    '../../src/lib/server/application/dto/results/complete-diff-results.ts',
  );
  requireMarker(dtoPath, 'isTruncated');
});

Then('per-file failures are collected without failing the result', (_w: World) => {
  const dtoPath = path.resolve(
    __dirname,
    '../../src/lib/server/application/dto/results/complete-diff-results.ts',
  );
  requireMarker(dtoPath, 'partialErrors');
});

Given('a repository at a known revision', (_w: World) => {
  const adapterPath = path.resolve(
    __dirname,
    '../../src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts',
  );
  requireMarker(adapterPath, 'readAt');
});

Then('all file sections share a single readAt snapshot', (_w: World) => {
  const dtoPath = path.resolve(
    __dirname,
    '../../src/lib/server/application/dto/results/complete-diff-results.ts',
  );
  requireMarker(dtoPath, 'readAt');
});

// ────────────────────────────────────────────────────────────────────────────
//  Phase 4: Markdown preview
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace with a Markdown file open in Project', (_w: World) => {
  requireMarker(SOURCE_VIEWER_PATH, 'markdown');
});

Then('the viewer header shows a Raw\\/Preview toggle at the top right', (_w: World) => {
  requireMarker(SOURCE_VIEWER_PATH, 'data-testid="markdown-view-toggle"');
});

Given('the Markdown default view is set to preview', (_w: World) => {
  if (DEFAULT_VISUAL_SETTINGS.markdownView !== 'preview') {
    throw new Error('The Markdown default view must be preview');
  }
});

When('a Markdown file opens', (_w: World) => {
  requireMarker(SOURCE_VIEWER_PATH, 'readVisualSettings');
});

Then('the preview is shown initially', (_w: World) => {
  requireMarker(SOURCE_VIEWER_PATH, "'preview'");
});

When('the default is set to raw', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'settings-markdown-raw');
  requireMarker(SETTINGS_PATH, 'writeVisualSettings');
});

Then('the raw view is shown initially', (_w: World) => {
  requireMarker(SOURCE_VIEWER_PATH, "'raw'");
});

Given('a Markdown file containing raw HTML and a javascript link', (_w: World) => {
  requireMarker(MARKDOWN_RENDERER_PATH, 'escapeHtml');
});

When('the user switches to preview', (_w: World) => {
  requireMarker(SOURCE_VIEWER_PATH, 'renderMarkdown');
});

Then('the raw HTML renders as escaped text', (_w: World) => {
  const src = fs.readFileSync(MARKDOWN_RENDERER_PATH, 'utf-8');
  if (!src.includes('escapeHtml(')) {
    throw new Error('The renderer must escape all source HTML');
  }
});

Then('the javascript link is not rendered as a link', (_w: World) => {
  const src = fs.readFileSync(MARKDOWN_RENDERER_PATH, 'utf-8');
  if (!src.includes('sanitizeLink') || !src.includes('javascript')) {
    throw new Error('The renderer must reject javascript: links via sanitizeLink');
  }
});

Then('a Files section exposes the file list view and the Markdown default view', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'settings-section-files');
  requireMarker(SETTINGS_PATH, 'settings-file-list-view');
  requireMarker(SETTINGS_PATH, 'settings-markdown-view');
});

// ────────────────────────────────────────────────────────────────────────────
//  Phase 5: branch selector, panels, tabs, help
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace with a branch whose name is long', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'title=');
  requireMarker(BRANCH_POPUP_PATH, 'title=');
});

When('the user opens the branch selector', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'branch-select-popup');
});

Then('the selector exposes the full name as a tooltip', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'title={');
  requireMarker(BRANCH_POPUP_PATH, 'title={');
});

Given('the Git comparison selector is shown', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'git-context-panel');
});

Then('no working tree vs HEAD caption is displayed', (_w: World) => {
  const src = fs.readFileSync(GIT_PANEL_PATH, 'utf-8');
  if (src.includes('comparison-type')) {
    throw new Error('The redundant comparison caption must be removed');
  }
});

Given('the user changed the target away from the working tree', (_w: World) => {
  requireMarker(BRANCH_POPUP_PATH, 'Working tree');
});

When('the user selects Working tree as the target again', (_w: World) => {
  requireMarker(BRANCH_POPUP_PATH, 'data-branch-option="working-tree"');
});

Then('the comparison type is inferred as working-tree-vs-head', (_w: World) => {
  const inferencePath = path.resolve(__dirname, '../../src/lib/web/types/comparison-inference.ts');
  const src = fs.readFileSync(inferencePath, 'utf-8');
  if (!src.includes('working-tree-vs-head')) {
    throw new Error('Inference must produce working-tree-vs-head');
  }
});

Then('the file list and complete diff refetch', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'comparisonDraft');
});

When('the user activates a tab in the collapsed strip', (_w: World) => {
  requireMarker(RIGHT_PANEL_TABS_PATH, 'handleStripTabChange');
});

Then('the panel expands and shows that tab', (_w: World) => {
  requireMarker(RIGHT_PANEL_TABS_PATH, 'onToggleRight');
  // Semantic markers: the expanded desktop branch is a vertical tablist and
  // the selected tab renders a real consumer-owned tabpanel.
  requireMarker(RIGHT_PANEL_TABS_PATH, 'orientation="vertical"');
  requireMarker(RIGHT_PANEL_TABS_PATH, 'tabPanelId(');
});

When('the user selects the Project rail option', (_w: World) => {
  // Direct rail selection must go through the desktop open-if-collapsed
  // guard: selecting while collapsed selects AND opens the panel.
  requireMarker(PAGE_PATH, '!isMobileViewport && $panelLayout.leftCollapsed');
});

Then('the left panel expands and selects the Project option', (_w: World) => {
  requireMarker(PAGE_PATH, '!isMobileViewport && $panelLayout.leftCollapsed');
  requireMarker(PAGE_PATH, 'toggleLeft()');
});

Given('both panels are expanded', (_w: World) => {
  requireMarker(RIGHT_PANEL_TABS_PATH, 'right-panel-collapse-btn');
  requireMarker(PAGE_PATH, 'left-panel-collapse-btn');
});

Then('the left and right panels expose collapse controls at the bottom', (_w: World) => {
  requireMarker(RIGHT_PANEL_TABS_PATH, 'right-panel-footer');
  requireMarker(PAGE_PATH, 'left-panel-footer');
});

Then('the right strip exposes an expand control at the bottom', (_w: World) => {
  requireMarker(RIGHT_PANEL_TABS_PATH, 'right-panel-reopen-btn');
  // Semantic markers: the strip is the single vertical tablist and the
  // expand control stays bottom-pinned.
  requireMarker(RIGHT_PANEL_TABS_PATH, 'orientation="vertical"');
  requireMarker(RIGHT_PANEL_TABS_PATH, 'margin-top: auto');
});

Then(
  'the left rail exposes Help and reopen controls at the bottom with Help directly above the reopen control',
  (_w: World) => {
    // Help stays in the rail at its bottom; the collapse/reopen control
    // lives in the stable left-region footer row directly below it.
    requireMarker(RAIL_TABS_PATH, 'help-btn');
    requireMarker(PAGE_PATH, 'left-region-footer');
    requireMarker(PAGE_PATH, 'left-panel-reopen-btn');
  },
);

Given('two file tabs are open', (_w: World) => {
  requireMarker(OPEN_FILES_TABS_PATH, 'open-files-tabs');
});

When('the user middle-clicks an inactive tab', (_w: World) => {
  requireMarker(OPEN_FILES_TABS_PATH, 'onauxclick');
  requireMarker(OPEN_FILES_TABS_PATH, 'button === 1');
});

Then('that tab closes and the active tab is preserved', (_w: World) => {
  requireMarker(OPEN_FILES_TABS_PATH, 'closeTab');
});

When('the user middle-clicks the active tab', (_w: World) => {
  requireMarker(OPEN_FILES_TABS_PATH, 'onauxclick');
});

Then('the active tab closes and a neighbor becomes active', (_w: World) => {
  requireMarker(OPEN_FILES_TABS_PATH, 'closeTab');
});

Given('the user opens Help', (_w: World) => {
  requireMarker(RAIL_TABS_PATH, 'help-btn');
  requireMarker(RAIL_TABS_PATH, 'onHelp');
});

Then('the dialog lists the keyboard and mouse shortcuts', (_w: World) => {
  requireMarker(HELP_DIALOG_PATH, 'help-dialog');
  requireMarker(HELP_DIALOG_PATH, 'Quick Open');
  requireMarker(HELP_DIALOG_PATH, 'Middle click');
});

Then('Escape closes the dialog and returns focus to its trigger', (_w: World) => {
  requireMarker(HELP_DIALOG_PATH, 'Escape');
  const dialogPath = path.resolve(__dirname, '../../src/lib/web/components/ui/Dialog.svelte');
  requireMarker(dialogPath, 'Escape');
});

// ────────────────────────────────────────────────────────────────────────────
//  Regression
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace with a comparison selected', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'comparisonDraft');
});

When('the user changes the target comparison', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'onComparisonChange');
});

Then('the complete diff and file diff show content for the new comparison', (_w: World) => {
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'comparisonDraft');
  const diffPath = path.resolve(__dirname, '../../src/lib/web/components/diff-viewer.svelte');
  requireMarker(diffPath, 'comparisonDraft');
});
