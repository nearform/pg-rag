import { PromptTemplate } from '@langchain/core/prompts'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const extractText = (filename: string) =>
  readFileSync(path.resolve(__dirname, filename), 'utf-8')

export const makePrompt = (
  filename: string,
  inputVariables: string[] = ['query']
) =>
  new PromptTemplate({
    template: extractText(filename),
    inputVariables: inputVariables
  })