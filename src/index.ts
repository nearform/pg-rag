import pg from 'pg'
import { Embeddings } from '@langchain/core/embeddings'
import { migrate } from './db/migrations/migrate.js'
import { pino } from 'pino'
import * as db from './db/documents.js'
import { init as initJobQueue } from './jobs/index.js'
import { insertVectorColumn } from './db/vector/index.js'
import { fileTypeFromBuffer } from 'file-type'
import { LLM } from '@langchain/core/language_models/llms'
import { hybridRetrieve, rag as doRag } from './llm/index.js'
import { getOpenAIResult } from './llm/openai.js'
import OpenAI from 'openai'
import { summarizeText } from './llm/summary.js'
import { RagResponse, FileArgs, RagArgs, DocArgs } from './helpers/models.js'
import { FILE_EXT, MAIN_EXT } from './helpers/constants.js'
import { convertToPdf, convertToImage } from './services.ts/fileProcessing.js'

const logger = pino({ name: 'pg-rag' })

interface PgRagOptions {
  dbPool: pg.Pool
  embeddings: Embeddings
  chatModel: LLM
  imageConversionModel: OpenAI
  resetDB?: boolean // Resets the DB on inititalization
}

export async function init(options: PgRagOptions) {
  logger.info('Initializing')

  if (options.resetDB) {
    await migrate(options.dbPool, '0')
  }
  await migrate(options.dbPool, '1')
  await insertVectorColumn(options.dbPool, options.embeddings)

  const jobQueue = await initJobQueue(options.dbPool, options.embeddings)

  const saveDocument = async (args: FileArgs) => {
    try {
      logger.debug('Parsing document')
      const fileType = await fileTypeFromBuffer(args.data)
      let docText = ''

      if (fileType && FILE_EXT.indexOf(fileType.ext.toLowerCase())) {
        //make a pdf file and read from it
        let pdfArgs: FileArgs = args
        if (fileType.ext.toLowerCase() !== MAIN_EXT) {
          pdfArgs = await convertToPdf(args)
        }

        const imageUrls = await convertToImage(pdfArgs)
        //call openAI to get results
        const chatCompletion = await getOpenAIResult(
          options.imageConversionModel,
          imageUrls
        )
        if (!chatCompletion || !chatCompletion.choices) {
          throw new Error(`File was not processed correctly ${args.name}`)
        }
        for (const response of chatCompletion.choices) {
          docText += response.message.content
        }
      } else if (fileType) {
        throw new Error(
          `Unsupported file of mime type "${fileType.mime}" with extension "${fileType.ext}". Check the documentation for what types of files are supported by this library.`
        )
      } else {
        docText = args.data.toString('utf8')
      }
      logger.debug('Document parsed')

      return await storeData(args, docText)
    } catch (err) {
      logger.error(err)
      throw err
    }
  }

  const deleteDocument = async (documentId: number) => {
    const isDeleteSuccessful = await db.deleteDocument(
      options.dbPool,
      documentId
    )
    if (isDeleteSuccessful) {
      logger.info(`Document ${documentId} successfully deleted`)
    } else {
      logger.info(`Failed to delete document with id: ${documentId}`)
    }
  }

  const storeData = async (args: FileArgs, response: string) => {
    const doc = await db.saveDocument(options.dbPool, {
      name: args.name,
      raw_content: args.data.toString('base64'),
      content: response,
      metadata: { ...args.metadata, fileId: args.name }
    })
    return {
      id: doc.id,
      jobId: await jobQueue.processDocument({ documentId: doc.id })
    }
  }

  const retrieve = async (args: RagArgs) => {
    return hybridRetrieve(args, {
      dbPool: options.dbPool,
      embeddings: options.embeddings,
      model: options.chatModel
    })
  }

  const getDocuments = async (filters?: Record<string, string | string[]>) => {
    return await db.getDocuments(options.dbPool, filters)
  }

  const getDocument = async (doc: DocArgs) => {
    return await db.getDocument(options.dbPool, doc)
  }

  const rag = async (args: RagArgs) => {
    return doRag(args, {
      dbPool: options.dbPool,
      embeddings: options.embeddings,
      model: options.chatModel
    })
  }

  const summary = async (
    fileId: string,
    filters?: Record<string, string | string[]>
  ): Promise<RagResponse | undefined> => {
    const doc = await db.getDocument(options.dbPool, {
      metadata: filters,
      name: fileId
    })
    if (!doc || !doc.content) {
      console.log('unable to retrieve document')
      return undefined
    }
    const summaryText = await summarizeText(
      doc.content,
      options.chatModel,
      undefined
    )
    const response = { content: summaryText['output_text'], sources: [fileId] }
    return response
  }

  const shutdown = async () => {
    await jobQueue.pgBoss.stop()
  }

  logger.info('Initialized')
  return {
    saveDocument,
    deleteDocument,
    retrieve,
    rag,
    summary,
    getDocument,
    getDocuments,
    waitForDocumentProcessed: jobQueue.waitForDocumentProcessed,
    pgBoss: jobQueue.pgBoss,
    shutdown
  }
}
