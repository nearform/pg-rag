import { DBParams } from '../../helpers/models.js'
import { migrate } from './migrate.js'
import pg from 'pg'

export const resetDB = async (db: DBParams) => {
  const client = new pg.Client({
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password
  })

  try {
    await client.connect()

    console.log('\nWARNING! The database will be reset in 5 seconds.')

    await new Promise(resolve => setTimeout(resolve, 5000))

    await migrate(client, '0')
  } catch (error) {
    console.error('Error during database reset:', error)
  } finally {
    await client.end()
  }
}
