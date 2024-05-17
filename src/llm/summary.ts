import { PromptTemplate } from 'langchain/prompts'
import {
  loadSummarizationChain,
  SummarizationChainParams
} from 'langchain/chains'
import { LLM } from 'langchain/llms/base'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
type SummarizationChainParamsExtended = SummarizationChainParams & {
  returnIntermediateSteps: boolean
  input_key: string
  output_key: string
}

export interface SummarizationConfig {
  chunkSize?: number
  chunkOverlap?: number
  chainParams: SummarizationChainParamsExtended
  refined?: boolean // whether to use the refined method of text summarization instead of the default map-reduce
  verbose?: boolean // whether to print out the summarizations chaining steps in a verbose mode
}

const questionPrompt = new PromptTemplate({
  template: readFileSync(
    path.resolve(__dirname, './prompts/summary_default_question.txt'),
    'utf-8'
  ),
  inputVariables: ['text']
})

const refinePrompt = new PromptTemplate({
  template: readFileSync(
    path.resolve(__dirname, './prompts/summary_default_refined.txt'),
    'utf-8'
  ),
  inputVariables: ['existing_answer', 'text']
})

const DEFAULT_CHUNK_SIZE = 2000
const DEFAULT_CHUNK_OVERLAP = 2

const DEFAULT_CONFIG: SummarizationConfig = {
  chunkSize: DEFAULT_CHUNK_SIZE,
  chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  chainParams: {
    type: 'refine',
    questionPrompt,
    refinePrompt,
    returnIntermediateSteps: true,
    input_key: 'input_documents',
    output_key: 'text'
  }
}

export async function summarizeText(
  text: string,
  chatModel: LLM,
  config?: SummarizationConfig
) {
  const { chunkSize, chunkOverlap, chainParams } = {
    ...DEFAULT_CONFIG,
    ...config
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap
  })
  const docs = await textSplitter.createDocuments([text])

  const chain = loadSummarizationChain(chatModel, chainParams)
  return await chain.invoke({ input_documents: docs })
}
