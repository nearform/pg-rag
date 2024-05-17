import Postgrator from 'postgrator'
import pg from 'pg'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { pino } from 'pino'
import path from 'path'

const logger = pino({
  name: 'migration'
})

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function migrate(
  pool: pg.Pool,
  targetMigrationStep: string | undefined = undefined
) {
  let client: pg.PoolClient | undefined = undefined
  logger.info({ targetMigrationStep }, 'Starting DB schema migration')
  try {
    client = await pool.connect()

    const postgrator = new Postgrator({
      migrationPattern: path.join(__dirname, '*'),
      driver: 'pg',
      schemaTable: 'schemaversion',
      execQuery: query => client!.query(query)
    })

    const migrations = await postgrator.migrate(targetMigrationStep)
    logger.info({ migrations, targetMigrationStep }, 'Migrations applied')
  } catch (error) {
    logger.error(
      { migrations: error.appliedMigrations, targetMigrationStep },
      error.message
    )
  } finally {
    await client?.release()
  }
  logger.info({ targetMigrationStep }, 'Migration completed')
}
