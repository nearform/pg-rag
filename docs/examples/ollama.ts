/**
 *
 * Demo requirements:
 *
 * - Postgres DB credentials with admin rights
 * - Local Ollama running with mistral model pulled/
 *
 *
 *
 */

import fs from 'fs'
import pg from 'pg'
import path from 'path'
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
import * as PgRag from '../../src/index.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Ollama } from '@langchain/community/llms/ollama'

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
  await pgRag.saveDocument({ data: pdf, fileName: 'example.pdf' })
  const summarization = await pgRag.summarize(
    fs.readFileSync(path.join(__dirname, './book.txt'), 'utf-8')
  )
  console.log('Summary', summarization)

  setTimeout(async () => {
    const res = await pgRag.search({
      prompt: 'Tell me about Sparse Vector Representation'
    })
    console.log(res)
    process.exit()
  }, 5000)
}

run()
