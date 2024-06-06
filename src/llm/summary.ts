import {
  loadSummarizationChain,
  SummarizationChainParams
} from 'langchain/chains'
import { LLM } from '@langchain/core/language_models/llms'
import { PromptTemplate } from '@langchain/core/prompts'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

import { makePrompt } from './promptManipulation.js'

type SummarizationChainParamsExtended = SummarizationChainParams & {
  returnIntermediateSteps: boolean
  input_key: string
  output_key: string
  questionPrompt: PromptTemplate
  refinePrompt: PromptTemplate
}

export interface SummarizationConfig {
  chunkSize?: number
  chunkOverlap?: number
  chainParams: SummarizationChainParamsExtended
  refined?: boolean // whether to use the refined method of text summarization instead of the default map-reduce
  verbose?: boolean // whether to print out the summarizations chaining steps in a verbose mode
}

const questionPrompt = makePrompt('./prompts/summary_default_question.txt', [
  'text'
])
const refinePrompt = makePrompt('./prompts/summary_default_refined.txt', [
  'existing_answer',
  'text'
])

const DEFAULT_CHUNK_SIZE = 2000
const DEFAULT_CHUNK_OVERLAP = 2

export async function summarizeText(
  text: string,
  chatModel: LLM,
  config?: SummarizationConfig
) {
  const { chunkSize, chunkOverlap, chainParams } = {
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    chainParams: {
      type: 'refine' as const,
      questionPrompt,
      refinePrompt,
      returnIntermediateSteps: true,
      input_key: 'input_documents',
      output_key: 'text'
    },
    ...config
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap
  })
  const docs = await textSplitter.createDocuments([text])

  const chain = loadSummarizationChain(
    chatModel,
    chainParams as SummarizationChainParams
  )
  return await chain.invoke({ input_documents: docs })
}
