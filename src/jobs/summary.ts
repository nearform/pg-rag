import { PromptTemplate } from '@langchain/core/prompts'
import {
  SummarizationChainParams,
  loadSummarizationChain
} from 'langchain/chains'
import { LLM } from 'langchain/llms/base'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

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
  template: `Write a concise summary of the following:
{text}
CONCISE SUMMARY:`,
  inputVariables: ['text']
})

const refinePrompt = new PromptTemplate({
  template: `Your job is to produce a final summary
We have provided an existing summary up to a certain point: {existing_answer}
We have the opportunity to refine the existing summary (only if needed) with some more context below.
------------
{text}
------------
Given the new context, refine the original summary. If the context isn't useful, return the original summary.
`,
  inputVariables: ['existing_answer', 'text']
})

const DEFAULT_CONFIG: SummarizationConfig = {
  chunkSize: 4000,
  chunkOverlap: 2,
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
  return await chain.call({ input_documents: docs })
}
