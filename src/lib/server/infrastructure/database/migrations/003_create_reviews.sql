CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'in_progress', 'completed', 'archived')
  ),
  comparison_json TEXT NOT NULL CHECK (json_valid(comparison_json)),
  comparison_type TEXT NOT NULL CHECK (
    comparison_type IN (
      'working-tree-vs-head',
      'staged-vs-head',
      'unstaged',
      'branch-vs-branch',
      'commit-vs-commit',
      'commit-vs-working-tree',
      'branch-vs-working-tree',
      'commit-range'
    )
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
