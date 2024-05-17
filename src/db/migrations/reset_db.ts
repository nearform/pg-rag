import { migrate } from './migrate.js'
import pg from 'pg'
import { db } from '../../dev_config.js'

const client = new pg.Client({
  host: db.host,
  port: db.port,
  database: db.database,
  user: db.user,
  password: db.password
})

setTimeout(() => {
  migrate(client, '0')
}, 5000)

console.log('\nWARNING! The database will be reset in 5 seconds.')
