import { Embeddings } from "@langchain/core/embeddings"
import pg from 'pg'
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector"
import { pino } from 'pino'

const logger = pino({name: 'pg-rag'})

const MAX_DIM_FOR_INDEX = 2000

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

const embeddingsColumnName = 'embedding'

export async function insertVectorColumn(pool:pg.Pool, embeddings:Embeddings) {
  const client = await pool.connect()

  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'document_chunks' AND column_name = 'embedding'")

  if(res && res.rows && !res.rows.find(row => row.column_name == embeddingsColumnName)) {
    const dimensionality = (await embeddings.embedQuery('hello')).length
    logger.info({msg: 'Could not find embedding column in the vector table. Adding it...', dimensionality})
    await client.query(`ALTER TABLE document_chunks ADD COLUMN ${embeddingsColumnName} vector(${dimensionality})`)
    if(dimensionality <= MAX_DIM_FOR_INDEX) {
      // hnsw indexes are only supported when dimension <= MAX_DIM_FOR_INDEX
      await client.query(`CREATE INDEX ON document_chunks USING hnsw (${embeddingsColumnName} vector_cosine_ops)`)
    } else {
      logger.warn({
        msg: 'No index have been added to the vector column because its dimensionality is too big',
        maxDimensionality: MAX_DIM_FOR_INDEX,
        actualDimensionality: dimensionality,
        column: embeddingsColumnName
      })
    }
  }

  await client.release()
}