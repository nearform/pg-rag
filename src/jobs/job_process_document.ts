import { Embeddings } from '@langchain/core/embeddings'
import { Document } from 'langchain/document'
import { LLM } from 'langchain/llms/base'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import pg from 'pg'
import PgBoss, { Job } from 'pg-boss'
import { pino } from 'pino'
import * as db from '../db/documents.js'
import { getVectorStore } from '../db/vector/index.js'
import { summarizeText } from './summary.js'

const logger = pino({ name: 'job_process_document' })

export interface JobData {
  documentId: number
}

export const QUEUE_NAME = 'process_document'

export const createJobProcessor = <T extends LLM>(args: {
  pool: pg.Pool
  embeddings: Embeddings
  pgBoss: PgBoss
  chatModel?: T
}) => {
  return async (job: Job<JobData>) => {
    try {
      logger.info({
        msg: 'Job received',
        jobId: job.id,
        documentId: job.data.documentId
      })

      const vectorStore = getVectorStore(args.pool, args.embeddings)

      logger.info('Fetching document from database')
      const doc = await db.getDocument(args.pool, { id: job.data.documentId })
      if (!doc) {
        logger.error({
          msg: 'Job failed',
          error: 'Could not retrieve document from the database',
          jobId: job.id,
          documentId: job.data.documentId
        })
        return
      }
      const docSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000, // The size of the chunk that should be split.
        chunkOverlap: 200, // Adding overalap so that if a text is broken inbetween, next document may have part of the previous document
        separators: ['/n/n', '.'] // In this case we are assuming that /n/n would mean one whole sentence. In case there is no nearing /n/n then "." will be used instead. This can be anything that helps derive a complete sentence .
      })
      logger.info('Splitting document')
      const splitDoc = await docSplitter.splitDocuments([
        {
          pageContent: doc?.content,
          metadata: { parentDocumentId: doc.id }
        }
      ])

      logger.info('Vectorizing document')
      vectorStore.addDocuments(splitDoc)

      if (doc?.content != null && args.chatModel != null) {
        logger.info('Summarizing document')
        const summary = await summarizeText(doc?.content, args.chatModel)
        doc.summary = summary.output_text

        logger.info('Vectorizing summary')
        const summaryDoc = new Document({
          pageContent: summary.output_text,
          metadata: { parentDocumentId: doc.id }
        })

        logger.info('Updating document summary')
        vectorStore.addDocuments([summaryDoc])
        await db.updateDocument(args.pool, doc)
        logger.info('Summarization process finished')
      }

      logger.info({
        msg: 'Job completed',
        jobId: job.id,
        documentId: job.data.documentId,
        chunks: splitDoc.length
      })
    } catch (err) {
      logger.error({
        msg: 'Job failed',
        error: err.message,
        jobId: job.id,
        documentId: job.data.documentId
      })
    }
  }
}
