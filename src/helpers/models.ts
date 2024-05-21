export interface ProcessedText {
  chunks: string
  summary: string
}

export interface RagResponse {
  content: string
  sources: string[]
}
