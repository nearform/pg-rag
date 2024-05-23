/**
 *
 * Demo requirements:
 *
 * - Postgres DB credentials with admin rights
 * - Local Ollama running with mistral model pulled
 *
 */

import fs from 'node:fs/promises'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import OpenAI from 'openai'
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
import { Ollama } from '@langchain/community/llms/ollama'
import * as PgRag from '../../src/index.js'
import * as config from './dev_config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ollamaLlm = new Ollama(config.ollama)
const embeddings = new OllamaEmbeddings(config.ollama)
const imageConversionModel = new OpenAI(config.gpt4o)
const fileName = 'files/example2.pptx'
async function run() {
  const pool = new pg.Pool(config.db)

  const file = await fs.readFile(path.join(__dirname, `./${fileName}`))
  const pgRag = await PgRag.init({
    dbPool: pool,
    embeddings,
    imageConversionModel: imageConversionModel,
    chatModel: ollamaLlm,
    resetDB: true
  })
  const jobId = await pgRag.saveDocument({ data: file, name: fileName })

  await pgRag.waitForDocumentProcessed(jobId!)
  const res = await pgRag.rag({
    prompt: 'what is the healthy eating week?'
  })
  console.log('Search response: ', res)
  const summary = await pgRag.summary(fileName)
  console.log('Summary response: ', summary)

  await pgRag.shutdown()
}

run()
