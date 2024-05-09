import pg from 'pg'
import { Embeddings } from "@langchain/core/embeddings"
import officeparser from 'officeparser'
import { migrate } from './db/migrations/migrate.js'
import { pino } from 'pino'
import * as db from './db/documents.js'
import { init as initJobQueue } from './jobs/index.js'
import { getVectorStore } from './db/vector/index.js'

const logger = pino({name: 'pg-rag'})

interface PgRagOptions {
  dbPool: pg.Pool,
  embeddings: Embeddings
  resetDB?: boolean // Resets the DB everytime
}

interface SaveArgs {
  data: Buffer
  fileName: string
}

interface RagArgs {
  prompt: string
}

export async function init(options:PgRagOptions) {
  logger.info('Initializing')

  if(options.resetDB) {
    await migrate(options.dbPool, '0')
  }
  await migrate(options.dbPool, '1')

  const jobQueue = await initJobQueue(options.dbPool, options.embeddings)
  const vectorStore = getVectorStore(options.dbPool, options.embeddings)

  const saveDocument = async (args: SaveArgs):Promise<string|null> => {
    try {
      logger.debug('Parsing document')
      const pdfContent = await officeparser.parseOfficeAsync(args.data)
      logger.debug('Document parsed')
      const doc = await db.saveDocument(options.dbPool, {
        name: args.fileName,
        raw_content: args.data.toString('base64'),
        content: pdfContent,
        metadata: {}
      })
      return await jobQueue.processDocument({documentId: doc.id})
    } catch(err) {
      logger.error(err)
    }
    return null
  }

  const search = async(args: RagArgs ) => {
    return await vectorStore.similaritySearch(args.prompt, 1);
  }
  logger.info('Initialized')
  return {
    saveDocument,
    search
  }
}