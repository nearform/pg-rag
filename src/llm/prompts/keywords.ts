import { PromptTemplate } from '@langchain/core/prompts'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


export const keywordsPrompt = new PromptTemplate({
  template: readFileSync(
    path.resolve(__dirname, './keywords.txt'),
    'utf-8'
  ),
  inputVariables: ['query']
})