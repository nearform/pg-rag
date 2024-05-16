CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS summary;
DROP TABLE IF EXISTS summary_chunks;

CREATE TABLE summary (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  raw_content bytea,
  content TEXT,
  metadata JSONB
);

CREATE TABLE summary_chunks (
  id BIGSERIAL PRIMARY KEY,
  -- embedding vector(XX), -- This column is dynamically inserted at initialization step to match the model's embeddings size
  content TEXT,
  metadata JSONB
);

CREATE INDEX ON summary_chunks USING GIN (to_tsvector('english', content));