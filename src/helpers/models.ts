export interface ProcessedText {
  chunks: string
  summary: string
}

export interface RagResponse {
  content: string
  sources: string[]
}

export interface FileArgs {
  data: Buffer
  name: string
  filters: Record<string, string>
}

/**
 * @param {string} prompt string input containing the query to be checked against the data
 * @param {number | undefined} limit value of the number of Keywords to be returned on the keyword check
 * @param {number | undefined} k  Number of most similar documents to return.
 */
export interface RagArgs {
  prompt: string
  limit?: number
  k?: number
  filters?: Record<string, string>
}

export interface DBParams {
  host: string
  port: number
  database: string
  user: string
  password: string | undefined
}
