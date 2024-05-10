import pg from 'pg'
import { Embeddings } from "@langchain/core/embeddings"
import officeparser from 'officeparser'
import { migrate } from './db/migrations/migrate.js'
import { pino } from 'pino'
import * as db from './db/documents.js'
import { init as initJobQueue } from './jobs/index.js'
import { getVectorStore, insertVectorColumn } from './db/vector/index.js'
import { fileTypeFromBuffer, FileTypeResult } from 'file-type';


const logger = pino({name: 'pg-rag'})

interface PgRagOptions {
  dbPool: pg.Pool,
  embeddings: Embeddings
  resetDB?: boolean // Resets the DB on inititalization
}

interface SaveArgs {
  data: Buffer
  name: string
}

interface RagArgs {
  prompt: string
}

function isOfficeFileType(fileType: FileTypeResult|undefined) {
  return fileType && ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'pdf'].includes(fileType.ext.toLowerCase())
}


export async function init(options:PgRagOptions) {
  logger.info('Initializing')

  if(options.resetDB) {
    await migrate(options.dbPool, '0')
  }
  await migrate(options.dbPool, '1')
  await insertVectorColumn(options.dbPool, options.embeddings)

  const jobQueue = await initJobQueue(options.dbPool, options.embeddings)
  const vectorStore = getVectorStore(options.dbPool, options.embeddings)

  const saveDocument = async (args: SaveArgs):Promise<string|null> => {
    try {
      logger.debug('Parsing document')
      const fileType = await fileTypeFromBuffer(args.data)
      let content:string|null = null
      if(isOfficeFileType(fileType)) {
        content = await officeparser.parseOfficeAsync(args.data)
      } else if (fileType) {
        throw new Error(`Unsupported file of mime type "${fileType.mime}" with extension "${fileType.ext}". Check the documentation for what types of files are supported by this library.`)
      } else {
        content = args.data.toString('utf8')
      }
      logger.debug('Document parsed')
      const doc = await db.saveDocument(options.dbPool, {
        name: args.name,
        raw_content: args.data.toString('base64'),
        content: content,
        metadata: {}
      })
      return await jobQueue.processDocument({documentId: doc.id})
    } catch(err) {
      logger.error(err)
      throw err
    }
  }

  const search = async(args: RagArgs ) => {
    return await vectorStore.similaritySearch(args.prompt, 1);
  }

  const shutdown = async () => {
    await jobQueue.pgBoss.stop()
  }

  logger.info('Initialized')
  return {
    saveDocument,
    search,
    waitForDocumentProcessed: jobQueue.waitForDocumentProcessed,
    pgBoss: jobQueue.pgBoss,
    shutdown
  }
}