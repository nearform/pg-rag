import fs from 'node:fs/promises'
import path from 'node:path'

export async function deleteDirectoryContents(directoryPath: string) {
  const files = await fs.readdir(directoryPath)

  for (const file of files) {
    const filePath = path.join(directoryPath, file)
    await fs.rm(filePath)
  }
}
