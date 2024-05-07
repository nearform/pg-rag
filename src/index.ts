import pg from 'pg'
import { Embeddings } from "@langchain/core/embeddings"
import parsePDF from 'pdf-parse/lib/pdf-parse'
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { migrate } from './migrations/migrate.js'

interface PgRagOptions {
  dbPool: pg.Pool,
  embeddings: Embeddings
  resetDB?: boolean // Resets the DB everytime
}

interface SaveArgs {
  data: Buffer
}

interface RagArgs {
  prompt: string
}

export async function init(options:PgRagOptions) {

  const config = {
    pool: options.dbPool,
    tableName: "document_chunks",
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
  };

  const vectorStore = new PGVectorStore(options.embeddings, config);

  let initialized = false
  if(!initialized) {
    if(options.resetDB) {
      await migrate(options.dbPool, '0')
    }
    await migrate(options.dbPool, '1')
    initialized = true
  }

  const saveDocument = async (args: SaveArgs) => {
    const pdfData:{text:string} = await parsePDF(args.data)

    const docSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000, // The size of the chunk that should be split.
      chunkOverlap: 200, // Adding overalap so that if a text is broken inbetween, next document may have part of the previous document
      separators: ["/n/n","."] // In this case we are assuming that /n/n would mean one whole sentence. In case there is no nearing /n/n then "." will be used instead. This can be anything that helps derive a complete sentence .
    });

    const splitDoc = await docSplitter.splitDocuments([{
      pageContent: pdfData.text,
      metadata: {}
    }]);

    await vectorStore.addDocuments(splitDoc);
  }

  const rag = async(args: RagArgs ) => {
    return await vectorStore.similaritySearch(args.prompt, 1);
  }

  return {
    saveDocument,
    rag
  }
}