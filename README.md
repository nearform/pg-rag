![CI](https://github.com/nearform/hub-template/actions/workflows/ci.yml/badge.svg?event=push)

# PG RAG

A library to make building LLM based POCs fast and easy.
This library provides RAG capability for files (`.pdf`, `.ppt`/`.pptx`, `.doc`/`.docx` and text). It stores data in postgreSQL and manages the DB schema for you.

## Usage

Install with

```sh
npm i -S @nearform/pg-rag
```

```ts
import pg from 'pg'
import PgRag from 'pg-rag'
import OpenAI from 'openai';

const openai = new OpenAI();

const pool = new pg.Pool({
  host: 'localhost',
  port: 5434,
  database: 'example',
  user: 'user',
  password: 'pwd',
});

const pgRag = PgRag({dbPool: pool})

const pdf = fs.readFileSync("./src/examples/example.pdf")
await pgRag.saveDocument({ data: pdf })

const question = 'What is this document about?'
const promptContext = pgRag.rag(question)


const chatCompletion = await openai.chat.completions.create({
  messages: [{
    role: 'user',
    content: `Here is some context to my question below. Use this context to answer the question.\n${promptContext}\n\n${question}`
  }],
  model: 'gpt-3.5-turbo',
});

console.log(chatCompletion)
```


## Is PG Rag for you?

PG Rag is not meant to provide a full fledged advanced RAG for any document and be able to answer any question.

## Improvements/TODO

- Use workers to process documents
- Summarize documents and vectorize that
- Use Hybrid search
- Add support for labels to categorize documents
-