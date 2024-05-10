import PGBoss from 'pg-boss'
import pg from 'pg'
const logger = pino({ name: 'pg-boss' })
import { pino } from 'pino'
import * as processDocs from './job_process_document.js'
import { Embeddings } from '@langchain/core/embeddings'
import { LLM } from 'langchain/llms/base'

interface Job {
  id: string
  state:
    | 'created'
    | 'archive'
    | 'active'
    | 'retry'
    | 'expired'
    | 'failed'
    | 'cancelled'
    | 'archive'
    | 'completed'
}

function getJobEndedBooleanStatus(job: Job) {
  if (['expired', 'failed', 'cancelled'].includes(job.state)) {
    return false
  } else if (['archive', 'completed'].includes(job.state)) {
    return true
  } else {
    return null
  }
}

function jobCheck(
  pgBoss: PGBoss,
  jobId: string,
  resolve: (success: boolean) => void,
  reject: (err: Error) => void,
  nextDelay = 500
) {
  pgBoss
    .getJobById(jobId)
    .then(job => {
      if (!job) {
        return reject(new Error('Could not find job with this id'))
      }

      const jobSuccessful = getJobEndedBooleanStatus(job)
      if (jobSuccessful === false) {
        resolve(false)
      } else if (jobSuccessful === true) {
        resolve(true)
      } else {
        setTimeout(() => {
          jobCheck(
            pgBoss,
            jobId,
            resolve,
            reject,
            Math.min(nextDelay + nextDelay / 2, 5000)
          )
        }, nextDelay)
      }
    })
    .catch(reject)
}

export async function init<T extends LLM>(
  pool: pg.Pool,
  embeddings: Embeddings,
  chatModel?: T
) {
  const pgBoss = new PGBoss({
    db: {
      executeSql: async (text, values) => {
        const client = await pool.connect()
        const { rows, rowCount } = await client.query(text, values)
        await client.release()
        return { rows, rowCount: rowCount || 0 }
      }
    }
  })

  await pgBoss.start()
  logger.info('Started')

  const queueJob = async <T extends object>(
    queueName: string,
    jobData: T
  ): Promise<string | null> => {
    logger.info({ msg: 'Queuing job', queueName, jobData })
    return await pgBoss.send(queueName, jobData)
  }

  pgBoss.work<processDocs.JobData>(
    processDocs.QUEUE_NAME,
    processDocs.createJobProcessor<T>({ pool, embeddings, pgBoss, chatModel })
  )
  const processDocument = async (doc: processDocs.JobData) => {
    const jobId = await queueJob<processDocs.JobData>(
      processDocs.QUEUE_NAME,
      doc
    )
    return jobId
  }

  const waitForDocumentProcessed = (jobId: string): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      jobCheck(pgBoss, jobId, resolve, reject)
    })
  }

  return {
    processDocument,
    waitForDocumentProcessed,
    pgBoss
  }
}
