import pg from 'pg'
import SQL, { SqlStatement } from '@nearform/sql'
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
  doc: { id?: number; name?: string; metadata?: Record<string, string> }
): Promise<Document | undefined> {
  const client = await connPool.connect()

  const conditionArray: SqlStatement[] = []
  if (doc.id) {
    conditionArray.push(SQL`id = ${doc.id}`)
  } else if (doc.name) {
    conditionArray.push(SQL`name = ${doc.name}`)
  } else if (!doc.metadata) {
    return undefined
  }
  if (doc.metadata) {
    for (const dataField in doc.metadata) {
      conditionArray.push(
        SQL`metadata ->> ${dataField} = ${doc.metadata[dataField]}`
      )
    }
  }
  const condition = SQL.glue(conditionArray, ' AND ')
  const q = SQL.glue([SQL`SELECT * FROM documents`, condition], ' WHERE ')
  const res = await client.query(q)
  await client.release()
  return res.rows ? res.rows[0] : undefined
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
  k?: number,
  filters?: Record<string, string>
): Promise<DocumentChunkResult[]> {
  const vectorResults = await vectorStore.similaritySearchWithScore(
    query,
    k,
    filters
  )

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
  options: SearchByKeywordOptions = { limit: 5 },
  filter?: Record<string, string>
): Promise<DocumentChunkResult[]> {
  const client = await connPool.connect()
  const metadataData: SqlStatement[] = []
  if (filter) {
    for (const f in filter) {
      metadataData.push(SQL`AND metadata ->> ${f} = ${filter[f]}`)
    }
  }
  const statement = SQL.glue(metadataData, ' ')
  const query = SQL.glue(
    [
      SQL`SELECT id, content, metadata, ts_rank(to_tsvector('english', content), query) AS score
  FROM document_chunks, plainto_tsquery('english', ${keywords}) as query
  WHERE to_tsvector('english', content)`,
      statement,
      SQL`@@ query ORDER BY score DESC LIMIT ${options.limit};`
    ],
    ' '
  )

  const res = await client.query(query)
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
