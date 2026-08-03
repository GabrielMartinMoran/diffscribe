-- 006_drop_observation_title_require_body.sql
--
-- Destructive migration (approved 2026-08-01):
--   * Deletes existing observations whose body is empty or whitespace-only
--     (the body becomes the single mandatory description field).
--   * Drops the `title` column from `observations`.
--   * Rebuilds the table so `body` is NOT NULL and enforces
--     `CHECK (length(trim(body)) > 0)` (1..5000 validated at the domain layer).
--   * Recreates the exact indexes and the review FK of migration 005.
--
-- `reviews.title` and every other invariant are untouched. Run inside the
-- migration runner transaction: atomic — any failure rolls back the whole
-- migration and it is not recorded in `_migrations`.

-- 1) Remove rows that would violate the new invariant (loss is authorized).
DELETE FROM observations
WHERE body IS NULL OR length(trim(body)) = 0;

-- 2) Rebuild the table without `title` and with the mandatory body.
CREATE TABLE observations_new (
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
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
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

INSERT INTO observations_new (
  id, review_id, type, severity, origin, status, body, agent_instruction,
  file_path, side, line_start, line_end, comparison_snapshot_json,
  diff_snapshot, content_hash, created_at, updated_at
)
SELECT
  id, review_id, type, severity, origin, status, body, agent_instruction,
  file_path, side, line_start, line_end, comparison_snapshot_json,
  diff_snapshot, content_hash, created_at, updated_at
FROM observations;

DROP TABLE observations;
ALTER TABLE observations_new RENAME TO observations;

-- 3) Recreate the indexes exactly as migration 005 defined them.
CREATE INDEX IF NOT EXISTS idx_observations_review_id ON observations(review_id);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);
