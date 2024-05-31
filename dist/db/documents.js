import SQL from '@nearform/sql';
export async function saveDocument(connPool, doc) {
    const client = await connPool.connect();
    const res = await client.query(SQL `INSERT INTO documents (name, content, raw_content, metadata)
    VALUES (${doc.name}, ${doc.content}, ${doc.raw_content}, ${JSON.stringify(doc.metadata)}::jsonb)
    RETURNING id`);
    await client.release();
    return res.rows[0];
}
export async function getDocument(connPool, doc) {
    const client = await connPool.connect();
    let query;
    if (doc.id) {
        query = SQL `SELECT * FROM documents WHERE id = ${doc.id}`;
    }
    else if (doc.name) {
        query = SQL `SELECT * FROM documents WHERE name = ${doc.name}`;
    }
    else if (doc.metadata) {
        query = SQL `SELECT * FROM documents WHERE metadata->> 'fileId' = '${doc.metadata.fileId}';`;
    }
    else {
        return undefined;
    }
    const res = await client.query(query);
    await client.release();
    return res.rows ? res.rows[0] : undefined;
}
export async function getDocuments(connPool) {
    const client = await connPool.connect();
    const query = SQL `SELECT id, name, metadata FROM documents`;
    const res = await client.query(query);
    await client.release();
    return res.rows ?? [];
}
export async function searchByVector(vectorStore, query, k) {
    const vectorResults = await vectorStore.similaritySearchWithScore(query, k);
    return vectorResults.map(v => {
        return {
            content: v[0].pageContent,
            metadata: v[0].metadata,
            score: v[1],
            type: 'vector'
        };
    });
}
export async function searchByKeyword(connPool, keywords, options = { limit: 5 }) {
    const client = await connPool.connect();
    const res = await client.query(SQL `
    SELECT id, content, metadata, ts_rank(to_tsvector('english', content), query) AS score
    FROM document_chunks, plainto_tsquery('english', ${keywords}) as query
    WHERE to_tsvector('english', content) @@ query ORDER BY score DESC LIMIT ${options.limit};
  `);
    await client.release();
    return res.rows.map(row => {
        return {
            id: row.id,
            content: row.content,
            metadata: row.metadata,
            score: row.score,
            type: 'keyword'
        };
    });
}
