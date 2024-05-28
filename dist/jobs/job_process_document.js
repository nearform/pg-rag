import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { pino } from 'pino';
import * as db from '../db/documents.js';
import { getVectorStore } from '../db/vector/index.js';
const logger = pino({ name: 'job_process_document' });
export const QUEUE_NAME = 'process_document';
export const createJobProcessor = (args) => {
    return async (job) => {
        try {
            logger.info({
                msg: 'Job received',
                jobId: job.id,
                documentId: job.data.documentId
            });
            const vectorStore = getVectorStore(args.pool, args.embeddings);
            logger.info('Fetching document from database');
            const doc = await db.getDocument(args.pool, { id: job.data.documentId });
            if (!doc) {
                logger.error({
                    msg: 'Job failed',
                    error: 'Could not retrieve document from the database',
                    jobId: job.id,
                    documentId: job.data.documentId
                });
                return;
            }
            const docSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 2000,
                chunkOverlap: 200,
                separators: ['/n/n', '.']
            });
            logger.info('Splitting document');
            const splitDoc = await docSplitter.splitDocuments([
                {
                    pageContent: doc?.content,
                    metadata: { ...doc?.metadata, parentDocumentId: doc.id }
                }
            ]);
            logger.info('Vectorizing document');
            vectorStore.addDocuments(splitDoc);
            logger.info({
                msg: 'Job completed',
                jobId: job.id,
                documentId: job.data.documentId,
                chunks: splitDoc.length
            });
        }
        catch (err) {
            logger.error({
                msg: 'Job failed',
                error: err.message,
                jobId: job.id,
                documentId: job.data.documentId
            });
        }
    };
};
