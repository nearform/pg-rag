import { Embeddings } from '@langchain/core/embeddings'
import { LLM } from 'langchain/llms/base'
import officeparser from 'officeparser'
import pg from 'pg'
import { pino } from 'pino'
import * as db from './db/documents.js'
import { migrate } from './db/migrations/migrate.js'
import { getVectorStore } from './db/vector/index.js'
import { init as initJobQueue } from './jobs/index.js'
import { SummarizationConfig, summarizeText } from './jobs/summary.js'

const logger = pino({ name: 'pg-rag' })

export interface PgRagOptions<T> {
  dbPool: pg.Pool
  chatModel?: T
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

export async function init<T extends LLM>({
  dbPool,
  embeddings,
  chatModel,
  resetDB
}: PgRagOptions<T>) {
  logger.info('Initializing')

  if (resetDB) {
    await migrate(dbPool, '0')
  }
  await migrate(dbPool, '1')

  const jobQueue = await initJobQueue(dbPool, embeddings)
  const vectorStore = getVectorStore(dbPool, embeddings)

  const saveDocument = async (args: SaveArgs): Promise<string | null> => {
    try {
      logger.debug('Parsing document')
      const pdfContent = await officeparser.parseOfficeAsync(args.data)
      logger.debug('Document parsed')
      const doc = await db.saveDocument(dbPool, {
        name: args.fileName,
        raw_content: args.data.toString('base64'),
        content: pdfContent,
        metadata: {}
      })
      return await jobQueue.processDocument({ documentId: doc.id })
    } catch (err) {
      logger.error(err)
    }
    return null
  }

  const search = async (args: RagArgs) => {
    return await vectorStore.similaritySearch(args.prompt, 1)
  }

  const summarize = async (text: string, config?: SummarizationConfig) => {
    if (chatModel == null) {
      throw new Error(
        'LLM is not defined. Please provide a valid LLM instance for summarization.'
      )
    }
    logger.debug('Summarizing text')
    return await summarizeText(text, chatModel, config)
  }

  logger.info('Initialized')

  return {
    saveDocument,
    search
  }
}
