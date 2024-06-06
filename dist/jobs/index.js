import PGBoss from 'pg-boss';
const logger = pino({ name: 'pg-boss' });
import { pino } from 'pino';
import * as processDocs from './job_process_document.js';
function getJobEndedBooleanStatus(job) {
    if (['expired', 'failed', 'cancelled'].includes(job.state)) {
        return false;
    }
    else if (['archive', 'completed'].includes(job.state)) {
        return true;
    }
    else {
        return null;
    }
}
function jobCheck(pgBoss, jobId, resolve, reject, nextDelay = 500) {
    pgBoss
        .getJobById(jobId)
        .then(job => {
        if (!job) {
            return reject(new Error('Could not find job with this id'));
        }
        const jobSuccessful = getJobEndedBooleanStatus(job);
        if (jobSuccessful === false) {
            resolve(false);
        }
        else if (jobSuccessful === true) {
            resolve(true);
        }
        else {
            setTimeout(() => {
                jobCheck(pgBoss, jobId, resolve, reject, Math.min(nextDelay + nextDelay / 2, 5000));
            }, nextDelay);
        }
    })
        .catch(reject);
}
export async function init(pool, embeddings) {
    const pgBoss = new PGBoss({
        db: {
            executeSql: async (text, values) => {
                const client = await pool.connect();
                const { rows, rowCount } = await client.query(text, values);
                await client.release();
                return { rows, rowCount: rowCount || 0 };
            }
        }
    });
    await pgBoss.start();
    logger.info('Started');
    const queueJob = async (queueName, jobData) => {
        logger.info({ msg: 'Queuing job', queueName, jobData });
        return await pgBoss.send(queueName, jobData);
    };
    pgBoss.work(processDocs.QUEUE_NAME, processDocs.createJobProcessor({ pool, embeddings, pgBoss }));
    const processDocument = async (doc) => {
        const jobId = await queueJob(processDocs.QUEUE_NAME, doc);
        return jobId;
    };
    const waitForDocumentProcessed = (jobId) => {
        return new Promise((resolve, reject) => {
            jobCheck(pgBoss, jobId, resolve, reject);
        });
    };
    return {
        processDocument,
        waitForDocumentProcessed,
        pgBoss
    };
}
