
import pg from 'pg'
import SQL from '@nearform/sql'


interface Document {
  id?: number
  name: string
  content: string
  raw_content: string
  metadata: object
}

export async function saveDocument(connPool:pg.Pool, doc:Document):Promise<{id:number}> {
  const client = await connPool.connect()
  const res = await client.query(SQL`INSERT INTO documents (name, content, raw_content, metadata)
    VALUES (${doc.name}, ${doc.content}, ${doc.raw_content}, ${doc.metadata})
    RETURNING id`)
  client.release()
  return res.rows[0]
}

export async function getDocument(connPool:pg.Pool, doc:{id: number}):Promise<Document|undefined> {
  const client = await connPool.connect()
  const res = await client.query(SQL`SELECT * FROM documents WHERE id = ${doc.id}`)
  client.release()
  return res.rows ? res.rows[0] : undefined
}
