import dotenv from 'dotenv'
dotenv.config({ path: '.env.dev' })

export const db = {
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432', 10) || 5432,
  database: process.env.DB_NAME || 'pgrag',
  user: process.env.DB_USER || 'pgrag',
  password: process.env.DB_PASSWORD,
}

export const ollama = {
  model: process.env.OLLAMA_MODEL || 'mistral',
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
}

export const gpt4o = {
  model: 'gpt-4o',
  temperature: 0.1,
  apiKey: process.env.OPENAI_API_KEY
}