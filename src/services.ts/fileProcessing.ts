import toPDF from 'office-to-pdf'

import { fromBuffer } from 'pdf2pic'
import { FileArgs } from '../helpers/models.js'

export async function convertToPdf(args: FileArgs): Promise<FileArgs> {
  const pdfArgs = args
  try {
    const pdf = (await toPDF(args.data)) as Buffer
    pdfArgs.data = pdf
  } catch (err) {
    console.log(`Unable to convert original file to pdf ${pdfArgs.name}`)
  }
  return pdfArgs
}

export const convertToImage = async (args: FileArgs): Promise<string[]> => {
  const convert = await fromBuffer(args.data, {
    format: 'jpeg'
  })
  const imageUrls = await convert.bulk(-1, { responseType: 'base64' })
  const images: string[] = []
  for (const img of imageUrls) {
    if (img.base64) {
      const imgStr = `data:image/jpeg;base64,${img.base64})`
      images.push(imgStr)
    }
  }
  return images
}
