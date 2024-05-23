![CI](https://github.com/nearform/hub-template/actions/workflows/ci.yml/badge.svg?event=push)

# PG RAG

A library to make building LLM based POCs fast and easy.
This library provides RAG capability for multiple file types.
If it is an office file it first converts it to pdf
It will convert the pdf to images, then GPT-4o Query it to retrieve a text version of all the data.
Then it stores the data in postgreSQL and manages the DB schema for you.
The user can then rag query, search or summarize the data.

![Overview](./docs/overview.png)

## Usage

### Diagram

### Usage 1 (microservice approach)

```
           +--------------------------------------------+
           |                  ETL Pipeline              |
           |                                            |
           |  +-----------+   +-----------+   +-------+ |
           |  |  Extract  |-->| Transform |-->|  Load | |
           |  +-----------+   +-----------+   +-------+ |
           |                        |                   |
           |                        |                   |
           |                  +---------------+         |
           |                  | pgrag         |         |
           |                  | saveDocument()|         |
           |                  +---------------+         |
           +--------------------------------------------+

           +------------------------------------------------+
           |                  Consumer                      |
           |                                                |
           |  +------------------------------------------+  |
           |  |                 pgrag                    |  |
           |  |  +-----------+  +----------+  +--------+||  |
           |  |  |  rag()    |  | search() |  |summary()||  |
           |  |  +-----------+  +----------+  +--------+||  |
           |  +------------------------------------------+  |
           +------------------------------------------------+
```

### Install with

```sh
npm i -S @nearform/pg-rag
```

For usage see the (./docs/examples)[./docs/examples] folder

## Is PG Rag for you?

PG Rag is not meant to provide a full fledged advanced RAG for any document and be able to answer any question.

## Supported files

This library provides RAG capability for files (`.pdf`, `.ppt`/`.pptx`, `.doc`/`.docx` and text).

## Development & running tests

Pre-requisites:

- run the commands
- PostgreSQL with the pgvector extension available/installed
- Ollama running locally with `mistral` model installed
- run the following commands

- install the following applications:

  - Ghostscript:
    - Mac OS: run the command: `brew install ghostscript`
    - Linux and Windows: https://ghostscript.com/docs/9.54.0/Install.htm
  - ImageMagick:
    - https://imagemagick.org/script/download.php
  - LibreOffice:
    - https://www.libreoffice.org/download/download-libreoffice/

- Install the npm packages `npm i`

Copy and adapt the `.env.example` file to `.env.dev` and adapt it.
Ensure your PostgreSQL database user is able to install the pgvector extension or pre-install it.

## Implementing the code

### Save document

```
    import fs from 'node:fs/promises'
    import path, { dirname } from 'node:path'
    import { fileURLToPath } from 'node:url'
    import pg from 'pg'
    import OpenAI from 'openai'
    // different embeddings options available at:
    // https://python.langchain.com/v0.1/docs/integrations/text_embedding/
    import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
    // different llm models avaialable at:
    // https://python.langchain.com/v0.1/docs/integrations/chat/
    import { Ollama } from '@langchain/community/llms/ollama'
    import PgRag from '@nearform/pg-rag'

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const ollamaLlm = new Ollama(config.ollama)
    const embeddings = new OllamaEmbeddings(config.ollama)
    const imageConversionModel = new OpenAI(config.gpt4o)
    const fileName = 'example.pptx'
    async function run() {
    const pool = new pg.Pool({INITIATE_DB_PARAMS})

    const file = await fs.readFile(path.join(__dirname, `./${fileName}`))

    //Initialize the package
    const pgRag = await PgRag.init({
        dbPool: pool,
        embeddings,
        imageConversionModel: imageConversionModel,
        chatModel: ollamaLlm,
        resetDB: true
    })

    //Saves the document
    const jobId = await pgRag.saveDocument({ data: file, name: fileName })


    await pgRag.waitForDocumentProcessed(jobId!)

    await pgRag.shutdown()
    }

    run()
```

### Search the database

```
    import pg from 'pg'
    import OpenAI from 'openai'
    // different embeddings options available at:
    // https://python.langchain.com/v0.1/docs/integrations/text_embedding/
    import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
    // different llm models avaialable at:
    // https://python.langchain.com/v0.1/docs/integrations/chat/
    import { Ollama } from '@langchain/community/llms/ollama'
    import PgRag from '@nearform/pg-rag'

    const ollamaLlm = new Ollama(config.ollama)
    const embeddings = new OllamaEmbeddings(config.ollama)
    const imageConversionModel = new OpenAI(config.gpt4o)

    async function run() {
        const pool = new pg.Pool({INITIATE_DB_PARAMS})

        //Initialize the package
        const pgRag = await PgRag.init({
            dbPool: pool,
            embeddings,
            imageConversionModel: imageConversionModel,
            chatModel: ollamaLlm,
            resetDB: true
        })

        const res = await pgRag.rag({
        prompt: 'Tell me about Sparse Vector Representation'
        })

        // handle response here

        await pgRag.shutdown()
    }

    run()
```

Response

```
    {
    content: ` The British Nutrition Foundation's Healthy Eating Week is an initiative taking place from 13-17 June 2022. Its goal is to promote healthier and more sustainable diets and lifestyles, with the message being "Eat well for you and the planet!" A healthier and more sustainable diet considers factors such as health, nutrition, environment, and affordability, although there's no one-size-fits-all approach. The food system contributes significantly to greenhouse gases, freshwater use, and land occupation. Following a plant-rich diet as suggested by the Eatwell Guide can bring both environmental and health benefits, like reducing greenhouse gases and water usage, and lowering the risk of diseases like type 2 diabetes, heart disease, and stroke. Each day of the week focuses on a theme to help individuals make positive changes: Monday (focus on fibre), Tuesday (get at least 5 A DAY), Wednesday (vary your protein), Thursday (stay hydrated), and Friday (reduce food waste).`,
    sources: [ 'files/example2.pptx' ]
    }
```

### Summarize document

```
    import pg from 'pg'
    import OpenAI from 'openai'
    // different embeddings options available at:
    // https://python.langchain.com/v0.1/docs/integrations/text_embedding/
    import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
    // different llm models avaialable at:
    // https://python.langchain.com/v0.1/docs/integrations/chat/
    import { Ollama } from '@langchain/community/llms/ollama'
    import * as PgRag from '@nearform/pg-rag'

    const ollamaLlm = new Ollama(config.ollama)
    const embeddings = new OllamaEmbeddings(config.ollama)
    const imageConversionModel = new OpenAI(config.gpt4o)

    const filename = 'example.pdf'

    async function run() {
        const pool = new pg.Pool({INITIATE_DB_PARAMS})

        //Initialize the package
        const pgRag = await PgRag.init({
            dbPool: pool,
            embeddings,
            imageConversionModel: imageConversionModel,
            chatModel: ollamaLlm,
            resetDB: true
        })

        //summarize file by filename
        const summary = await pgRag.summary(fileName)

        // handle response here

        await pgRag.shutdown()
    }

    run()
```

Response

```
{
    content: " The British Nutrition Foundation's Healthy Eating Week from 13-17 June 2022 emphasizes the importance of healthier and more sustainable diets for individuals and the planet. During this week, each day focuses on different themes to encourage positive changes:\n" +
    '\n' +
    '**Monday:** Focus on fibre - For meals and snacks\n' +
    'Have more wholegrain foods, fruit and vegetables, beans, peas, lentils, and plant-based protein sources like red kidney beans, peanut butter, red lentils, mixed nuts, Textured Vegetable Protein (TVP), and chickpeas. Eating plenty of fibre is associated with a lower risk of heart disease, stroke, type 2 diabetes, and bowel cancer. \n' +
    '\n' +
    '**Tuesday:** Get at least 5 A DAY - Put plenty on your plate\n' +
    'Have at least 5 portions of a variety of fruit and vegetables every day. Fruit and vegetables provide essential vitamins, minerals, and fibre while tending to have a low environmental impact.\n' +
    '\n' +
    '**Wednesday:** Vary your protein - Be more creative\n' +
    'Eat a wider variety of protein foods and choose plant-based protein more often. Plant-based proteins include red kidney beans, peanut butter, red lentils, mixed nuts, Textured Vegetable Protein (TVP), chickpeas, and others.\n' +
    '\n' +
    '**Thursday:** Stay hydrated - Fill up from the tap\n' +
    'Drink about 6-8 drinks a day (about 1.2 litres) to maintain optimal hydration levels. Tap water is an affordable and eco-friendly choice, making this an easy step towards a more sustainable diet. \n' +
    '\n' +
    '**Friday:** Reduce food waste - Know your portions\n' +
    'Plan meals, use leftovers creatively, and understand appropriate portion sizes to minimize food waste. \n' +
    '\n' +
    'For more information, go to: [https://www.nutrition.org.uk/healthy-eating-week/](https://www.nutrition.org.uk/healthy-eating-week/)',
    sources: [ 'files/example2.pptx' ]
}

```
