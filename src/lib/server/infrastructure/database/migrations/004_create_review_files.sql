CREATE TABLE IF NOT EXISTS review_files (
  review_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  reviewed_at TEXT,
  PRIMARY KEY (review_id, file_path),
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);
