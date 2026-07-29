CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('issue', 'risk', 'suggestion', 'question', 'praise', 'note')
  ),
  severity TEXT CHECK (
    severity IN ('critical', 'major', 'minor', 'nitpick')
  ),
  origin TEXT NOT NULL DEFAULT 'human' CHECK (
    origin IN ('human', 'ai-generated')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('open', 'resolved', 'dismissed', 'pending')
  ) DEFAULT 'open',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  agent_instruction TEXT NOT NULL DEFAULT '',
  file_path TEXT,
  side TEXT NOT NULL DEFAULT 'new' CHECK (side IN ('new', 'old')),
  line_start INTEGER,
  line_end INTEGER,
  comparison_snapshot_json TEXT NOT NULL CHECK (json_valid(comparison_snapshot_json)),
  diff_snapshot TEXT,
  content_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  CHECK (
    (diff_snapshot IS NULL AND content_hash IS NULL) OR
    (diff_snapshot IS NOT NULL AND content_hash IS NOT NULL)
  ),
  CHECK (
    (file_path IS NULL AND diff_snapshot IS NULL) OR
    (file_path IS NOT NULL AND diff_snapshot IS NOT NULL)
  ),
  CHECK (
    (line_start IS NULL AND line_end IS NULL) OR
    (line_start IS NOT NULL AND line_end IS NOT NULL AND line_end >= line_start)
  ),
  CHECK (
    (line_start IS NOT NULL AND file_path IS NOT NULL) OR
    line_start IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_observations_review_id ON observations(review_id);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);
