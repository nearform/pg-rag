import pg from 'pg'
import SQL from '@nearform/sql'
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'

interface Document {
  id?: number
  name: string
  content: string
  raw_content: string
  metadata: object
}

export async function saveDocument(
  connPool: pg.Pool,
  doc: Document
): Promise<{ id: number }> {
  const client = await connPool.connect()
  const res =
    await client.query(SQL`INSERT INTO documents (name, content, raw_content, metadata)
    VALUES (${doc.name}, ${doc.content}, ${doc.raw_content}, ${JSON.stringify(doc.metadata)}::jsonb)
    RETURNING id`)
  await client.release()
  return res.rows[0]
}

export async function getDocument(
  connPool: pg.Pool,
  doc: { id?: number; name?: string; metadata?: { fileId: string } }
): Promise<Document | undefined> {
  const client = await connPool.connect()
  if (doc.id) {
    const res = await client.query(
      SQL`SELECT * FROM documents WHERE id = ${doc.id}`
    )
    await client.release()
    return res.rows ? res.rows[0] : undefined
  } else if (doc.name) {
    const res = await client.query(
      SQL`SELECT * FROM documents WHERE name = ${doc.name}`
    )
    await client.release()
    return res.rows ? res.rows[0] : undefined
  } else if (doc.metadata) {
    const res = await client.query(
      SQL`SELECT * FROM documents WHERE metadata->> 'fileId' = '${doc.metadata.fileId}';`
    )
    await client.release()
    return res.rows ? res.rows[0] : undefined
  } else {
    console.log('Unable to retrieve document')
    return undefined
  }
}

interface SearchByKeywordOptions {
  limit: number
}

export interface DocumentChunkResult {
  id?: string
  content: string
  metadata: object
  score: number
  type: 'vector' | 'keyword'
}

export async function searchByVector(
  vectorStore: PGVectorStore,
  query: string,
  k?: number
): Promise<DocumentChunkResult[]> {
  const vectorResults = await vectorStore.similaritySearchWithScore(query, k)

  return vectorResults.map(v => {
    return {
      content: v[0].pageContent,
      metadata: v[0].metadata,
      score: v[1],
      type: 'vector'
    }
  })
}

export async function searchByKeyword(
  connPool: pg.Pool,
  keywords: string,
  options: SearchByKeywordOptions = { limit: 5 }
): Promise<DocumentChunkResult[]> {
  const client = await connPool.connect()
  const res = await client.query(SQL`
    SELECT id, content, metadata, ts_rank(to_tsvector('english', content), query) AS score
    FROM document_chunks, plainto_tsquery('english', ${keywords}) as query
    WHERE to_tsvector('english', content) @@ query ORDER BY score DESC LIMIT ${options.limit};
  `)
  await client.release()
  return res.rows.map(row => {
    return {
      id: row.id as string,
      content: row.content as string,
      metadata: row.metadata as object,
      score: row.score as number,
      type: 'keyword'
    }
  })
}
