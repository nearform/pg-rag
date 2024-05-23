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
