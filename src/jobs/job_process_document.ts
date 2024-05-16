import { Embeddings } from "@langchain/core/embeddings"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { Job } from 'pg-boss'
import { pino } from 'pino'
import pg from 'pg'
import * as db from '../db/documents.js'
import { getVectorStore } from "../db/vector/index.js"
import PgBoss from 'pg-boss'


const logger = pino({name: 'job_process_document'})

export interface JobData {
  documentId: number
}

export const QUEUE_NAME = 'process_document'

export const createJobProcessor = (args: {pool:pg.Pool, embeddings:Embeddings, pgBoss:PgBoss}) => {
    return async(job:Job<JobData>) => {
      try {
        logger.info({msg: 'Job received', jobId: job.id, documentId: job.data.documentId})

        const vectorStore = getVectorStore(args.pool, args.embeddings)

        logger.info('Fetching document from database')
        const doc = await db.getDocument(args.pool, {id: job.data.documentId}, 'documents')
        if(!doc) {
          logger.error({msg: 'Job failed', error: 'Could not retrieve document from the database', jobId: job.id, documentId: job.data.documentId})
          return
        }
        const docSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 2000, // The size of the chunk that should be split.
          chunkOverlap: 200, // Adding overalap so that if a text is broken inbetween, next document may have part of the previous document
          separators: ["/n/n","."] // In this case we are assuming that /n/n would mean one whole sentence. In case there is no nearing /n/n then "." will be used instead. This can be anything that helps derive a complete sentence .
        });
        logger.info('Splitting document')
        const splitDoc = await docSplitter.splitDocuments([{
          pageContent: doc?.content,
          metadata: { parentDocumentId: doc.id }
        }]);

        logger.info('Vectorizing document')
        vectorStore.addDocuments(splitDoc);
        logger.info({msg: 'Job completed', jobId: job.id, documentId: job.data.documentId, chunks: splitDoc.length})
      } catch(err) {
        logger.error({msg: 'Job failed', error: err.message, jobId: job.id, documentId: job.data.documentId})
      }
    }
}