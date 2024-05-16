import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


export const ExtractSummary = readFileSync(
    path.resolve(__dirname, './extractSummary.txt'),
    'utf-8'
  )
 