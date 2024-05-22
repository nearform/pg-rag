![CI](https://github.com/nearform/hub-template/actions/workflows/ci.yml/badge.svg?event=push)

# PG RAG

A library to make building LLM based POCs fast and easy.
This library provides RAG capability for .pdf files. It converts the files to images stores data in postgreSQL and manages the DB schema for you.
The user can then rag query, search or summarize the data.

![Overview](./docs/overview.png)

## Usage

Install with

```sh
npm i -S @nearform/pg-rag
```

For usage see the (./docs/examples)[./docs/examples] folder

## Is PG Rag for you?

PG Rag is not meant to provide a full fledged advanced RAG for any document and be able to answer any question.

## Supported files

pg-rag only supports PDF files

## Development & running tests

Pre-requisites:

- run the commands
- PostgreSQL with the pgvector extension available/installed
- Ollama running locally with `mistral` model installed
- run the following commands

```
    brew install --use-gsc graphicsmagick
    brew install ghostscript
    brew install libreoffice
    mkdir files (to locally store the pdfs while using the app)
```

Copy and adapt the `.env.example` file to `.env.dev` and adapt it.
Ensure your PostgreSQL database user is able to install the pgvector extension or pre-install it.

## Improvements/TODO

- Summarize documents and vectorize that
- Use Hybrid search
- Add support for labels to categorize documents
