import { DBParams } from '../../helpers/models.js'
import { migrate } from './migrate.js'
import pg from 'pg'

export const resetDB = async (db: DBParams) => {
  const pool = new pg.Pool({
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password
  })

  try {
    console.log('\nWARNING! The database will be reset in 5 seconds.')

    await new Promise(resolve => setTimeout(resolve, 5000))

    await migrate(pool, '0')
  } catch (error) {
    console.error('Error during database reset:', error)
  } finally {
    await pool.end()
  }
}
