import * as db from '../db/documents.js';
import { getVectorStore } from '../db/vector/index.js';
import { performance } from 'node:perf_hooks';
import { makePrompt } from './promptManipulation.js';
function reRank(vectorResults, keywordResults, searchReRankBalance = 3.1) {
    const rankedResults = [
        ...vectorResults,
        ...keywordResults.map(obj => ({
            ...obj,
            score: obj.score * searchReRankBalance
        }))
    ];
    rankedResults.sort((a, b) => b.score - a.score);
    return rankedResults;
}
export async function hybridRetrieve(args, conf) {
    const searchReRankBalance = conf.searchReRankBalance || 3;
    const keywordsPrompt = makePrompt('./prompts/keywords.txt');
    const limit = args.limit || 10;
    const vectorStore = getVectorStore(conf.dbPool, conf.embeddings);
    const vectorResults = await db.searchByVector(vectorStore, args.prompt, args.k, args.filters);
    const searchByKeywordPrompt = await keywordsPrompt.format({
        query: args.prompt
    });
    const keywords = await conf.model.invoke(searchByKeywordPrompt);
    const keywordResults = await db.searchByKeyword(conf.dbPool, keywords, {
        limit: limit
    }, args.filters);
    let rerankedResults = reRank(vectorResults, keywordResults, searchReRankBalance);
    rerankedResults = rerankedResults.slice(0, limit);
    return rerankedResults;
}
export async function rag(args, conf) {
    performance.measure('RAG');
    const searchResults = await hybridRetrieve(args, conf);
    const sources = Array.from(new Set(searchResults.map(sr => {
        const metadata = sr.metadata;
        return metadata['fileId'];
    })));
    const ragPrompt = makePrompt('./prompts/rag.txt', ['query', 'documents']);
    const compiledRagPrompt = await ragPrompt.format({
        query: args.prompt,
        documents: searchResults
            .slice(0, 3)
            .map(r => r.content)
            .join('/n/n/n')
    });
    const response = await conf.model.invoke(compiledRagPrompt);
    return { content: response, sources: sources };
}
