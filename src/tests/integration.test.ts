

import {describe, it} from 'node:test';
import assert from 'assert'
import { init } from '../index.js'
import pg from 'pg'
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import * as config from '../dev_config.js'

const embeddings = new OllamaEmbeddings(config.ollama);

const pool = new pg.Pool(config.db)


describe('Integration test', async () => {

  it('PDF document', async () => {

    const pgRag = await init({dbPool: pool, embeddings, resetDB: true})

    const jobId = await pgRag.saveDocument({data: Buffer.from('Hello world', 'utf8'), name: 'hello world'})
    assert.ok(jobId)
    await pgRag.waitForDocumentProcessed(jobId)

    const res = await pgRag.search({prompt: 'Hello World'})
    pgRag.shutdown()

    assert.ok(res)
    assert.ok(res[0])
    assert.ok(res[0].pageContent)
    assert.equal(res[0].pageContent, 'Hello world')
  })
})



