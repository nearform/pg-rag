import OpenAI from 'openai';
import { fromBuffer } from "pdf2pic";
import { ExtractText } from './prompts/extractText.js';
import { ToBase64Response } from 'pdf2pic/dist/types/convertResponse.js';
import { ExtractSummary } from './prompts/extractSummary.js';
import { ProcessedText } from '../helpers/models.js';




export async function get_document_details(file: Buffer):Promise<ProcessedText> {
  const openai = new OpenAI();
  const convert = await fromBuffer(file, {
    format:'png'
  })
  const imageUrls = await convert.bulk(-1, {responseType:'base64'})

  const data:ProcessedText = {
    chunks: await get_document_text(openai, imageUrls),
    summary:''
  }

  data.summary = await get_document_summary(openai, data.chunks)
  
  return data
}

const get_document_text = async (openai: OpenAI, imageUrls: ToBase64Response[]):Promise<string>=>{

  const imageChatPart:OpenAI.Chat.Completions.ChatCompletionContentPartImage[] = []
  imageUrls.map(base64Img => imageChatPart.push({
    type: "image_url",
    image_url: {
      url: base64Img.base64??""
    }
  }))

  const content:OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      "type": "text",
      "text": ExtractText
    },
    ...imageChatPart
  ]

  const chatCompletion = await openai.chat.completions.create({

    messages: [
      {
        "role": "user",
        "content": content
      }],
    model: 'gpt-4o',
  });

  let resultText = ""
  for(const choice of chatCompletion.choices) {
      resultText += choice.message.content + "\n\n"
  }

return resultText
}

export const get_document_summary =  async (openai: OpenAI|undefined, response:string ):Promise<string>=>{
  if(!openai){
    openai = new OpenAI();
  }
  const content:OpenAI.Chat.Completions.ChatCompletionContentPartText[] = [
    {
      "type": "text",
      "text": ExtractSummary
    },
    {
      "type": "text",
      "text": response
    }
  ]

  const chatCompletion = await openai.chat.completions.create({

    messages: [
      {
        "role": "user",
        "content": content
      }],
    model: 'gpt-3.5-turbo-0125',
  });

  let resultText = ""
  for(const choice of chatCompletion.choices) {
      resultText += choice.message.content + "\n\n"
  }

return resultText
}