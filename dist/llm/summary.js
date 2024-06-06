import { loadSummarizationChain } from 'langchain/chains';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { makePrompt } from './promptManipulation.js';
const questionPrompt = makePrompt('./prompts/summary_default_question.txt', [
    'text'
]);
const refinePrompt = makePrompt('./prompts/summary_default_refined.txt', [
    'existing_answer',
    'text'
]);
const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_CHUNK_OVERLAP = 2;
export async function summarizeText(text, chatModel, config) {
    const { chunkSize, chunkOverlap, chainParams } = {
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
        chainParams: {
            type: 'refine',
            questionPrompt,
            refinePrompt,
            returnIntermediateSteps: true,
            input_key: 'input_documents',
            output_key: 'text'
        },
        ...config
    };
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap
    });
    const docs = await textSplitter.createDocuments([text]);
    const chain = loadSummarizationChain(chatModel, chainParams);
    return await chain.invoke({ input_documents: docs });
}
