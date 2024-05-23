export interface ProcessedText {
  chunks: string
  summary: string
}

export interface RagResponse {
  content: string
  sources: string[]
}

export interface SaveArgs {
  data: Buffer
  name: string
}

export interface DBParams {
  host: string
  port: number
  database: string
  user: string
  password: string | undefined
}
