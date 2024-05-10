import { Embeddings } from '@langchain/core/embeddings'
import pg from 'pg'
import PGBoss from 'pg-boss'
import { pino } from 'pino'
import * as processDocs from './job_process_document.js'
const logger = pino({ name: 'pg-boss' })

export async function init(pool: pg.Pool, embeddings: Embeddings) {
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
    processDocs.createJobProcessor({ pool, embeddings })
  )
  const processDocument = async (doc: processDocs.JobData) => {
    return await queueJob<processDocs.JobData>(processDocs.QUEUE_NAME, doc)
  }

  return {
    processDocument
  }
}
