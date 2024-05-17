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
import { getDocumentDetails, summarizeText} from './llm/openai.js'
import { ChainValues } from 'langchain/schema'
import { OpenAI } from '@langchain/openai'

const logger = pino({name: 'pg-rag'})

interface PgRagOptions {
  dbPool: pg.Pool,
  embeddings: Embeddings
  chatModel: LLM,
  imageConversionModel: OpenAI,
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
      let responses: ChainValues| undefined
      if(fileType &&fileType.ext.toLowerCase() == 'pdf') {
        responses = await getDocumentDetails(options.imageConversionModel,args.data)
        if(!responses){
          throw new Error(`File was not processed correctly ${args.name}`)
        }
      } else if (fileType) {
        throw new Error(`Unsupported file of mime type "${fileType.mime}" with extension "${fileType.ext}". Check the documentation for what types of files are supported by this library.`)
      } else {
        responses = {'output': args.data.toString('utf8')}
      }
      logger.debug('Document parsed')

      await storeData(args, responses['output'])
      } catch(err) {
        logger.error(err)
        throw err
      }
  }

  const storeData = async(args: SaveArgs, response: string)=>{
    
    const doc = await db.saveDocument(options.dbPool, {
      name: args.name,
      raw_content: args.data.toString('base64'),
      content:response,
      metadata: {fileId: args.name}
    })
    await jobQueue.processDocument({documentId: doc.id})


  }

  const retrieve = async(args: RagArgs) => {
    return hybridRetrieve(args, {
      dbPool: options.dbPool,
      embeddings: options.embeddings,
      model: options.chatModel
    })
  }

  const rag = async(args: RagArgs) => {
    return doRag(args, {
      dbPool: options.dbPool,
      embeddings: options.embeddings,
      model: options.chatModel
    })
  }
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  const summary = async(fileId:string):Promise< Record<string, any> |undefined>=> {
    const doc = await db.getDocument(options.dbPool, {metadata:{fileId:fileId}})
    if(!doc || !doc.content){
      console.log('unable to retrieve document')
      return undefined
    }
    const summaryText = await summarizeText(doc.content,options.chatModel,undefined)
    return summaryText
  }

  const shutdown = async () => {
    await jobQueue.pgBoss.stop()
  }

  logger.info('Initialized')
  return {
    saveDocument,
    retrieve,
    rag,
    summary,
    waitForDocumentProcessed: jobQueue.waitForDocumentProcessed,
    pgBoss: jobQueue.pgBoss,
    shutdown
  }
}
