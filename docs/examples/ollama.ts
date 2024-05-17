/**
 *
 * Demo requirements:
 *
 * - Postgres DB credentials with admin rights
 * - Local Ollama running with mistral model pulled
 *
 */

import fs from 'fs'
import pg from 'pg'
import path from 'path'
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import * as PgRag from '../../src/index.js'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as config from '../../src/dev_config.js'
import { Ollama } from "@langchain/community/llms/ollama";
import { OpenAI } from "@langchain/openai";



const __dirname = dirname(fileURLToPath(import.meta.url));
const ollamaLlm = new Ollama(config.ollama);

const embeddings = new OllamaEmbeddings(config.ollama);
const imageConversionModel = new OpenAI(config.gpt4o);
async function run() {
  const pool = new pg.Pool(config.db);

  const pdf = fs.readFileSync(path.join(__dirname, './example.pdf'))

  const pgRag = await PgRag.init({dbPool: pool, embeddings, imageConversionModel: imageConversionModel, chatModel: ollamaLlm, resetDB: true})
  const jobId = await pgRag.saveDocument({data: pdf, name: 'example.pdf'})

  await pgRag.waitForDocumentProcessed(jobId!)
  const res = await pgRag.rag({prompt: 'Tell me about Sparse Vector Representation'})
  console.log('Search response', res)
  const summary = await pgRag.summary('example.pdf')
  console.log('Summary response', summary)

  await pgRag.shutdown()
}

run()