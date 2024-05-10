/**
 *
 * Demo requirements:
 *
 * - Postgres DB credentials with admin rights
 * - Local Ollama running with mistral model pulled
 *
 */

import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
import { Ollama } from '@langchain/community/llms/ollama'
import fs from 'fs'
import path, { dirname } from 'path'
import pg from 'pg'
import { fileURLToPath } from 'url'
import * as PgRag from '../../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const embeddings = new OllamaEmbeddings({
  model: 'mistral',
  baseUrl: 'http://127.0.0.1:11434'
})

const chatModel = new Ollama({
  model: 'mistral',
  baseUrl: 'http://127.0.0.1:11434'
})

async function run() {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5436,
    database: 'pgrag',
    user: 'pgrag',
    password: 'pgrag'
  })

  const pdf = fs.readFileSync(path.join(__dirname, './example.pdf'))

  const pgRag = await PgRag.init({
    dbPool: pool,
    embeddings,
    chatModel,
    resetDB: true
  })
  const jobId = await pgRag.saveDocument({ data: pdf, name: 'example.pdf' })

  await pgRag.waitForDocumentProcessed(jobId!)

  const res = await pgRag.search({
    prompt: 'Tell me about Sparse Vector Representation'
  })
  console.log('Search response', res)
  await pgRag.shutdown()
}

run()
