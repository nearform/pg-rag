import { Embeddings } from "@langchain/core/embeddings"
import pg from 'pg'
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector"

export function getVectorStore(pool:pg.Pool, embeddings:Embeddings) {
  const config = {
    pool,
    tableName: "document_chunks",
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
  };
  return new PGVectorStore(embeddings, config);
}