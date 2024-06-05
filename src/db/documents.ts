import pg from 'pg'
import SQL, { SqlStatement } from '@nearform/sql'
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import { Metadata } from '@langchain/community/vectorstores/singlestore'
import { DocArgs } from '../helpers/models.js'

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
  doc: DocArgs
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
      if (dataField == 'filenames') {
        conditionArray.push(
          SQL`metadata ->> 'fileId' IN (${SQL.map(doc.metadata[dataField] as string[], name => SQL.unsafe(`'${name}'`))})`
        )
      } else if (typeof dataField == 'string') {
        conditionArray.push(
          SQL`metadata ->> ${dataField} = ${doc.metadata[dataField]}`
        )
      }
    }
  }
  const condition = SQL.glue(conditionArray, ' AND ')
  const q = SQL.glue([SQL`SELECT * FROM documents`, condition], ' WHERE ')
  const res = await client.query(q)
  await client.release()
  return res.rows ? res.rows[0] : undefined
}

export async function getDocuments(
  connPool: pg.Pool,
  filters?: Record<string, string | string[]>
): Promise<Document[]> {
  const client = await connPool.connect()

  const conditionArray: SqlStatement[] = []

  if (filters != null) {
    for (const dataField in filters) {
      if (dataField == 'filenames') {
        conditionArray.push(
          SQL`metadata ->> 'fileId' IN (${SQL.map(filters[dataField] as string[], name => SQL.unsafe(`'${name}'`))})`
        )
      } else if (typeof dataField == 'string') {
        conditionArray.push(
          SQL`metadata ->> ${dataField} = ${filters[dataField]}`
        )
      }
    }
  }
  const condition = SQL.glue(conditionArray, ' AND ')
  const q = SQL.glue(
    [SQL`SELECT id, name, metadata FROM documents`, condition],
    ' WHERE '
  )
  const res = await client.query(q)
  await client.release()
  return res.rows ?? []
}

export async function deleteDocument(
  connPool: pg.Pool,
  id: number
): Promise<boolean | undefined> {
  const client = await connPool.connect()
  try {
    if (id > 0) {
      await client.query(
        SQL`DELETE FROM document_chunks WHERE metadata ->>  'parentDocumentId' = ${id.toString()}`
      )
      await client.query(SQL`DELETE FROM documents WHERE id = ${id}`)
      await client.release()
    } else {
      throw new Error('Provided invalid Id for deletion')
    }
    return true
  } catch (error) {
    console.log(`Failed to delete document with id: ${id} `, error)
    return false
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

function transformFilters(
  filters: Record<string, string | string[]> | undefined
): Metadata | undefined {
  if (!filters) {
    return undefined
  }
  let metadata: Metadata = {}
  for (const key in filters) {
    if (key == 'filenames') {
      metadata = { ...metadata, fileId: { $in: filters[key] } }
    }
    metadata = { ...metadata, key: filters[key] }
  }

  return metadata
}

export async function searchByVector(
  vectorStore: PGVectorStore,
  query: string,
  k?: number,
  filters?: Record<string, string | string[]>
): Promise<DocumentChunkResult[]> {
  const filterOptions = transformFilters(filters)

  const vectorResults = await vectorStore.similaritySearchWithScore(
    query,
    k,
    filterOptions
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
  filter?: Record<string, string | string[]>
): Promise<DocumentChunkResult[]> {
  const client = await connPool.connect()
  const metadataData: SqlStatement[] = []

  if (filter) {
    for (const f in filter) {
      if (typeof filter[f] == 'string') {
        metadataData.push(SQL` metadata ->> ${f} = ${filter[f]} AND`)
      } else if (f == 'filenames') {
        metadataData.push(
          SQL`metadata ->> 'fileId' IN (${SQL.map(filter[f] as string[], name => SQL.unsafe(`'${name}'`))})`
        )
      }
    }
  }
  const statement = SQL.glue(metadataData, ' ')

  const query = SQL.glue(
    [
      SQL`SELECT id, content, metadata, ts_rank(to_tsvector('english', content), query) AS score
  FROM document_chunks, plainto_tsquery('english', ${keywords}) as query
  WHERE`,
      SQL.glue(
        [statement ?? SQL``, SQL`to_tsvector('english', content)`],
        ' AND '
      ),
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
