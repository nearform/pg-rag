import { fromBuffer } from 'pdf2pic'
import { ToBase64Response } from 'pdf2pic/dist/types/convertResponse.js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const extractTextPrompt = readFileSync(
  path.resolve(__dirname, './prompts/extractText.txt'),
  'utf-8'
)

export async function getDocumentDetails(
  model: OpenAI,
  file: Buffer
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const convert = await fromBuffer(file, {
    format: 'png'
  })
  const imageUrls = await convert.bulk(-1, { responseType: 'base64' })
  const chatCompletion = await model.chat.completions.create(
    getOpenAIMessageBody(imageUrls)
  )
  console.log(JSON.stringify(chatCompletion.choices))
  return chatCompletion
}

const getOpenAIMessageBody = (
  imageUrls: ToBase64Response[]
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming => {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: extractTextPrompt
    }
  ]
  imageUrls.map(img => {
    if (img.base64) {
      const image: OpenAI.Chat.Completions.ChatCompletionContentPart = {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.base64}`
        }
      }
      content.push(image)
    }
  })

  return {
    messages: [
      {
        role: 'user',
        content: content
      }
    ],
    model: 'gpt-4o'
  }
}
