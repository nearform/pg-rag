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
  metadata: Record<string, string | string[]>
}

/**
 * @param {string} prompt string input containing the query to be checked against the data
 * @param {number | undefined} limit value of the number of Keywords to be returned on the keyword check
 * @param {number | undefined} k  Number of most similar documents to return.
 * @param {Record<string, any} filters Add filter metdata with the field, value attribute (e.g. "userId": 123, "filenames":["example.pdf","testing.pdf"])
 */
export interface RagArgs {
  prompt: string
  limit?: number
  k?: number
  filters?: Record<string, string | string[]>
}

export interface DBParams {
  host: string
  port: number
  database: string
  user: string
  password: string | undefined
}
