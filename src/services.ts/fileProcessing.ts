import toPDF from 'office-to-pdf'

import { fromBuffer } from 'pdf2pic'
import { OUTPUT_DIR } from '../helpers/constants.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { SaveArgs } from '../helpers/models.js'

export async function convertToPdf(args: SaveArgs): Promise<string> {
  const filename = `${args.name.split('.')[0]}.pdf`
  try {
    const pdf = (await toPDF(args.data)) as Buffer
    await fs.writeFile(path.join(OUTPUT_DIR, filename), pdf)
  } catch (err) {
    console.log(`Unable to convert original file to pdf ${args.name}`)
  }
  return filename
}

export const convertToImage = async (args: SaveArgs): Promise<string[]> => {
  const convert = await fromBuffer(args.data, {
    format: 'png'
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
