

import {describe, it} from 'node:test';
import assert from 'assert'
import { init } from '../index.js'
import pg from 'pg'
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import * as config from '../dev_config.js'
import { Ollama } from 'langchain/llms/ollama';
import { OpenAI } from 'openai';

const embeddings = new OllamaEmbeddings(config.ollama);
const ollamaLlm = new Ollama(config.ollama);
const imageConversionModel = new OpenAI(config.gpt4o);
const pool = new pg.Pool(config.db)


describe('Integration test', async () => {

  it('PDF document', async () => {

    const pgRag = await init({dbPool: pool, embeddings, resetDB: true, chatModel:ollamaLlm, imageConversionModel:imageConversionModel})

    const jobId = await pgRag.saveDocument({data: Buffer.from('Hello world', 'utf8'), name: 'hello world'})
    assert.ok(jobId)
    await pgRag.waitForDocumentProcessed(jobId)

    const res = await pgRag.rag({prompt: 'Hello World'})
    pgRag.shutdown()

    assert.ok(res)
  })
})



