import OpenAI from 'openai'
import { extractText } from './promptManipulation.js'

export const getOpenAIResult = async (
  model: OpenAI,
  imageUrls: string[]
): Promise<OpenAI.Chat.Completions.ChatCompletion | undefined> => {
  try {
    const chatCompletion = await model.chat.completions.create(
      getOpenAIMessageBody(imageUrls)
    )
    return chatCompletion
  } catch (err) {
    console.log('Error communicating with OpenAI', err)
  }
}

export const getOpenAIMessageBody = (
  imageUrls: string[]
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming => {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: extractText('./prompts/extractText.txt')
    }
  ]
  imageUrls.map(img => {
    const image: OpenAI.Chat.Completions.ChatCompletionContentPart = {
      type: 'image_url',
      image_url: {
        url: img
      }
    }
    content.push(image)
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
