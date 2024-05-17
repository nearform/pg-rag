
import { fromBuffer } from "pdf2pic";
import { ToBase64Response } from 'pdf2pic/dist/types/convertResponse.js';
import { PromptTemplate } from 'langchain/prompts';
import { SummarizationChainParams, loadQAChain, loadSummarizationChain } from 'langchain/chains';
import { LLM } from 'langchain/llms/base';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { readFileSync } from 'fs'
import path from 'path'
import { ChainValues } from 'langchain/schema';
import { OpenAI } from "@langchain/openai";
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

export interface ChatMessage{
  role: string,
  content: string| ChatMessage[]
}


export async function getDocumentDetails(model: OpenAI,file: Buffer):Promise<ChainValues> {
  const convert = await fromBuffer(file, {
    format:'png'
  })
  const imageUrls = await convert.bulk(-1, {responseType:'base64'})
  return await getDocumentText(model, imageUrls)
}

const getDocumentText = async ( model: OpenAI, imageUrls: ToBase64Response[]):Promise<ChainValues>=>{

  const messages:ChatMessage[] = []

  for (const img in imageUrls){
    messages.push({
        role: 'user',
        content: `data:image/jpeg;base64,${img}`
      })
  }
  
  const message:ChatMessage = {
    role: 'user',
    content: messages
  }
  

  const chain = loadQAChain(model)
  return await chain.invoke(message)
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