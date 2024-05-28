import { extractText } from './promptManipulation.js';
export const getOpenAIResult = async (model, imageUrls) => {
    try {
        const chatCompletion = await model.chat.completions.create(getOpenAIMessageBody(imageUrls));
        return chatCompletion;
    }
    catch (err) {
        console.log('Error communicating with OpenAI', err);
    }
};
export const getOpenAIMessageBody = (imageUrls) => {
    const content = [
        {
            type: 'text',
            text: extractText('./prompts/extractText.txt')
        }
    ];
    imageUrls.map(img => {
        const image = {
            type: 'image_url',
            image_url: {
                url: img
            }
        };
        content.push(image);
    });
    return {
        messages: [
            {
                role: 'user',
                content: content
            }
        ],
        model: 'gpt-4o'
    };
};
