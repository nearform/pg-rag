import dotenv from 'dotenv'
dotenv.config({ path: '.env.dev' })

export const db = {
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432', 10) || 5432,
  database: process.env.DB_NAME || 'pgrag',
  user: process.env.DB_USER || 'pgrag',
  password: process.env.DB_PASSWORD,
}