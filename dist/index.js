import { migrate } from './db/migrations/migrate.js';
import { pino } from 'pino';
import * as db from './db/documents.js';
import { init as initJobQueue } from './jobs/index.js';
import { insertVectorColumn } from './db/vector/index.js';
import { fileTypeFromBuffer } from 'file-type';
import { hybridRetrieve, rag as doRag } from './llm/index.js';
import { getOpenAIResult } from './llm/openai.js';
import { summarizeText } from './llm/summary.js';
import { FILE_EXT, MAIN_EXT } from './helpers/constants.js';
import { convertToPdf, convertToImage } from './services.ts/fileProcessing.js';
const logger = pino({ name: 'pg-rag' });
export async function init(options) {
    logger.info('Initializing');
    if (options.resetDB) {
        await migrate(options.dbPool, '0');
    }
    await migrate(options.dbPool, '1');
    await insertVectorColumn(options.dbPool, options.embeddings);
    const jobQueue = await initJobQueue(options.dbPool, options.embeddings);
    const saveDocument = async (args) => {
        let chatAnswer = '';
        try {
            logger.debug('Parsing document');
            const fileType = await fileTypeFromBuffer(args.data);
            let docText = '';
            if (fileType && FILE_EXT.indexOf(fileType.ext.toLowerCase())) {
                let pdfArgs = args;
                if (fileType.ext.toLowerCase() !== MAIN_EXT) {
                    pdfArgs = await convertToPdf(args);
                }
                const imageUrls = await convertToImage(pdfArgs);
                const chatCompletion = await getOpenAIResult(options.imageConversionModel, imageUrls);
                if (!chatCompletion || !chatCompletion.choices) {
                    throw new Error(`File was not processed correctly ${args.name}`);
                }
                for (const response of chatCompletion.choices) {
                    docText += response.message.content;
                }
            }
            else if (fileType) {
                throw new Error(`Unsupported file of mime type "${fileType.mime}" with extension "${fileType.ext}". Check the documentation for what types of files are supported by this library.`);
            }
            else {
                docText = args.data.toString('utf8');
            }
            logger.debug('Document parsed');
            chatAnswer = (await storeData(args, docText)) ?? '';
        }
        catch (err) {
            logger.error(err);
            throw err;
        }
        return chatAnswer;
    };
    const storeData = async (args, response) => {
        const doc = await db.saveDocument(options.dbPool, {
            name: args.name,
            raw_content: args.data.toString('base64'),
            content: response,
            metadata: { fileId: args.name }
        });
        return await jobQueue.processDocument({ documentId: doc.id });
    };
    const retrieve = async (args) => {
        return hybridRetrieve(args, {
            dbPool: options.dbPool,
            embeddings: options.embeddings,
            model: options.chatModel
        });
    };
    const rag = async (args) => {
        return doRag(args, {
            dbPool: options.dbPool,
            embeddings: options.embeddings,
            model: options.chatModel
        });
    };
    const summary = async (fileId, config) => {
        const doc = await db.getDocument(options.dbPool, { name: fileId });
        if (!doc || !doc.content) {
            console.log('unable to retrieve document');
            return undefined;
        }
        const summaryText = await summarizeText(doc.content, options.chatModel, config);
        const response = { content: summaryText['output_text'], sources: [fileId] };
        return response;
    };
    const shutdown = async () => {
        await jobQueue.pgBoss.stop();
    };
    logger.info('Initialized');
    return {
        saveDocument,
        retrieve,
        rag,
        summary,
        waitForDocumentProcessed: jobQueue.waitForDocumentProcessed,
        pgBoss: jobQueue.pgBoss,
        shutdown
    };
}