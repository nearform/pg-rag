import toPDF from 'office-to-pdf';
import { fromBuffer } from 'pdf2pic';
export async function convertToPdf(args) {
    const pdfArgs = {
        name: `${args.name.split('.')[0]}.pdf`,
        data: new Buffer('')
    };
    try {
        const pdf = (await toPDF(args.data));
        pdfArgs.data = pdf;
    }
    catch (err) {
        console.log(`Unable to convert original file to pdf ${pdfArgs.name}`);
    }
    return pdfArgs;
}
export const convertToImage = async (args) => {
    const convert = await fromBuffer(args.data, {
        format: 'png'
    });
    const imageUrls = await convert.bulk(-1, { responseType: 'base64' });
    const images = [];
    for (const img of imageUrls) {
        if (img.base64) {
            const imgStr = `data:image/jpeg;base64,${img.base64})`;
            images.push(imgStr);
        }
    }
    return images;
};
