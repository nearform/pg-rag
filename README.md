![CI](https://github.com/nearform/hub-template/actions/workflows/ci.yml/badge.svg?event=push)

# PG RAG

A library to make building LLM based POCs fast and easy.
This library provides RAG capability for files (`.pdf`, `.ppt`/`.pptx`, `.doc`/`.docx` and text). It stores data in postgreSQL and manages the DB schema for you.


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

pg-rag uses the (Officeparser)[https://github.com/harshankur/officeParser] library to parse files. Lookup this library to know what kind of files are supported.

## Improvements/TODO

- Summarize documents and vectorize that
- Use Hybrid search
- Add support for labels to categorize documents