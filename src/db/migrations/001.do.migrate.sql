CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS document_chunks;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  raw_content bytea,
  content TEXT,
  metadata JSONB
);

CREATE TABLE document_chunks (
  id BIGSERIAL PRIMARY KEY,
  embedding vector(4096),
  content TEXT,
  metadata JSONB
);