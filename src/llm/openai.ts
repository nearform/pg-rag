import { fromBuffer } from 'pdf2pic'
import { ToBase64Response } from 'pdf2pic/dist/types/convertResponse.js'
import OpenAI from 'openai'
import { extractText } from './promptManipulation.js'

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
      text: extractText('./prompts/extractText.txt')
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
