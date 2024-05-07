import fs from 'fs'
import pg from 'pg'
import path from 'path'
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import * as PgRag from '../index.js'

const embeddings = new OllamaEmbeddings({
  model: "mistral",
  baseUrl: "http://127.0.0.1:11434",
});

async function run() {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5436,
    database: 'pgrag',
    user: 'pgrag',
    password: 'pgrag',
  });

  const pdf = fs.readFileSync(path.join(__dirname, './example.pdf'))
  const pgRag = await PgRag.init({dbPool: pool, embeddings, resetDB: true})
  await pgRag.saveDocument({data: pdf})
  const res = await pgRag.rag({prompt: 'Tell me about Sparse Vector Representation'})
  console.log(res)
}

run()