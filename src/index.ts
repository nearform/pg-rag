import pg from 'pg'
import { Embeddings } from "@langchain/core/embeddings"
import { migrate } from './db/migrations/migrate.js'
import { pino } from 'pino'
import * as db from './db/documents.js'
import { init as initJobQueue } from './jobs/index.js'
import { insertVectorColumn } from './db/vector/index.js'
import { fileTypeFromBuffer } from 'file-type';
import { LLM } from 'langchain/llms/base'
import { RagArgs, hybridRetrieve, rag as doRag } from './llm/index.js'
import { get_document_details, get_document_summary } from './llm/openai.js'
import { ProcessedText } from './helpers/models.js'

const logger = pino({name: 'pg-rag'})

interface PgRagOptions {
  dbPool: pg.Pool,
  embeddings: Embeddings
  model: LLM
  resetDB?: boolean // Resets the DB on inititalization
}

interface SaveArgs {
  data: Buffer
  name: string
}

export async function init(options:PgRagOptions) {
  logger.info('Initializing')

  if(options.resetDB) {
    await migrate(options.dbPool, '0')
  }
  await migrate(options.dbPool, '1')
  await insertVectorColumn(options.dbPool, options.embeddings)

  const jobQueue = await initJobQueue(options.dbPool, options.embeddings)

  const saveDocument = async (args: SaveArgs) => {
    try {
      logger.debug('Parsing document')
      const fileType = await fileTypeFromBuffer(args.data)
      let responses: ProcessedText| undefined = undefined
      if(fileType &&fileType.ext.toLowerCase() == 'pdf') {
        responses = await get_document_details(args.data)
        
      } else if (fileType) {
        throw new Error(`Unsupported file of mime type "${fileType.mime}" with extension "${fileType.ext}". Check the documentation for what types of files are supported by this library.`)
      } else {
        const chunks = args.data.toString('utf8')
        responses = {
          chunks: chunks,
          summary: await get_document_summary(undefined, chunks)
        }

      }
      logger.debug('Document parsed')

      await Promise.all([storeData(args, responses.chunks,'documents'), storeData(args, responses.summary, 'summary')])
      } catch(err) {
        logger.error(err)
        throw err
      }
  }

  const storeData = async(args: SaveArgs, response: string, collection:string)=>{
    
      const doc = await db.saveDocument(options.dbPool, {
        name: args.name,
        raw_content: args.data.toString('base64'),
        content:response,
        metadata: {fileId: args.name}
      },collection)
      await jobQueue.processDocument({documentId: doc.id})


    }

  const retrieve = async(args: RagArgs) => {
    return hybridRetrieve(args, {
      dbPool: options.dbPool,
      embeddings: options.embeddings,
      model: options.model
    })
  }

  const rag = async(args: RagArgs) => {
    return doRag(args, {
      dbPool: options.dbPool,
      embeddings: options.embeddings,
      model: options.model
    })
  }

  const shutdown = async () => {
    await jobQueue.pgBoss.stop()
  }

  logger.info('Initialized')
  return {
    saveDocument,
    retrieve,
    rag,
    waitForDocumentProcessed: jobQueue.waitForDocumentProcessed,
    pgBoss: jobQueue.pgBoss,
    shutdown
  }
}
