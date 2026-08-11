const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const fs = require('fs');

const imagePath = 'uploads/1786459977837.jpeg';

async function testOCR() {
    console.log("--- PASS 1: RAW IMAGE ---");
    let result1 = await Tesseract.recognize(imagePath, 'spa');
    let text1 = result1.data.text;
    console.log(text1);
    
    console.log("\n--- PASS 2: JIMP PROCESSED ---");
    const tmpPath = imagePath + '_tmp.jpg';
    const image = await Jimp.read(imagePath);
    await image.greyscale().contrast(0.6).normalize().writeAsync(tmpPath);
    
    let result2 = await Tesseract.recognize(tmpPath, 'spa');
    let text2 = result2.data.text;
    console.log(text2);
    fs.unlinkSync(tmpPath);

    console.log("\n--- REGEX TEST ON PASS 2 ---");
    let iva = 0;
    let total = 0;
    
    const lines = text2.split('\n');
    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        const numRegex = /\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)\b/g;
        
        if (lowerLine.includes('total') && !lowerLine.includes('subtotal')) {
            let match;
            let lastNum = 0;
            while ((match = numRegex.exec(line)) !== null) {
                lastNum = parseFloat(match[1].replace(/[.,]/g, ''));
            }
            if (lastNum > total) total = lastNum;
        }
        
        if (lowerLine.includes('iva') || lowerLine.includes('19%')) {
            let match;
            let lastNum = 0;
            while ((match = numRegex.exec(line)) !== null) {
                const val = parseFloat(match[1].replace(/[.,]/g, ''));
                if (val !== 19) lastNum = val;
            }
            if (lastNum > 0 && lastNum < total) iva = lastNum;
        }
    });
    
    if (iva === 0 && total > 0) {
        iva = Math.round(total - (total / 1.19));
    }
    
    console.log(`Extracted IVA: ${iva}`);
    console.log(`Extracted TOTAL: ${total}`);
}

testOCR();
