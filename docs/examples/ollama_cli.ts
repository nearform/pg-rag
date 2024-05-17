import { program } from 'commander'

import fs from 'fs'
import pg from 'pg'
// import path from 'path'
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
import * as PgRag from '../../src/index.js'
// import { fileURLToPath } from 'url';
import * as config from '../../src/dev_config.js'
import { Ollama } from '@langchain/community/llms/ollama'
import OpenAI from 'openai'

program
  .option('-q, --query <query>')
  .option('-f, --files <path...>')
  .option('-r, --resetDB')

program.parse()

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
const options = program.opts()
const ollamaLlm = new Ollama(config.ollama)
const openAI = new OpenAI(config.gpt4o)

const embeddings = new OllamaEmbeddings(config.ollama)

async function run() {
  const pool = new pg.Pool(config.db)
  const pgRag = await PgRag.init({
    dbPool: pool,
    embeddings,
    imageConversionModel: openAI,
    chatModel: ollamaLlm,
    resetDB: options.resetDB
  })

  if (options.files) {
    for (const file of options.files) {
      const pdf = fs.readFileSync(file)
      const jobId = await pgRag.saveDocument({ data: pdf, name: file })
      await pgRag.waitForDocumentProcessed(jobId!)
    }
  }

  if (options.query) {
    const res = await pgRag.rag({ prompt: options.query })
    console.log(res)
  }

  await pgRag.shutdown()
}

run()
