import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";

console.log('[PDF] Initializing PDF utility module');

export async function extractTextFromPDF(file) {
  console.log(`[PDF] 🔄 extractTextFromPDF - Starting - File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  
  try {
    console.log(`[PDF] 🔄 Converting file to ArrayBuffer`);
    const startBufferTime = performance.now();
    const arrayBuffer = await file.arrayBuffer();
    const endBufferTime = performance.now();
    console.log(`[PDF] ✅ File converted to ArrayBuffer - Size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB, Time: ${(endBufferTime - startBufferTime).toFixed(2)}ms`);
    
    console.log(`[PDF] 🔄 Loading PDF document with pdfjs`);
    const startLoadTime = performance.now();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const endLoadTime = performance.now();
    console.log(`[PDF] ✅ PDF loaded - Pages: ${pdf.numPages}, Time: ${(endLoadTime - startLoadTime).toFixed(2)}ms`);
    
    let fullText = '';
    
    console.log(`[PDF] 🔄 Extracting text from ${pdf.numPages} pages`);
    const startExtractTime = performance.now();
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`[PDF] 🔄 Processing page ${pageNum}/${pdf.numPages}`);
      const pageStartTime = performance.now();
      
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      const pageText = strings.join(' ') + ' ';
      
      fullText += pageText;
      
      const pageEndTime = performance.now();
      console.log(`[PDF] ✅ Page ${pageNum} processed - Text length: ${pageText.length}, Time: ${(pageEndTime - pageStartTime).toFixed(2)}ms`);
    }
    
    const endExtractTime = performance.now();
    console.log(`[PDF] ✅ Text extraction complete - Total length: ${fullText.length}, Total time: ${((endExtractTime - startExtractTime) / 1000).toFixed(2)}s`);
    
    return fullText;
  } catch (error) {
    console.error(`[PDF] ❌ Error extracting text from PDF:`, error);
    console.error(`[PDF] ❌ Error details:`, {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export function chunkText(text, maxChunkSize = 4000) {
  console.log(`[PDF] 🔄 chunkText - Starting - Text length: ${text.length}, Max chunk size: ${maxChunkSize}`);
  
  // Split by paragraphs or sentences
  const paragraphs = text.split(/\n\s*\n|\.\s+/);
  console.log(`[PDF] 📊 Text split into ${paragraphs.length} paragraphs/sentences`);
  
  const chunks = [];
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed max size, save current chunk and start a new one
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    
    currentChunk += paragraph + " ";
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  console.log(`[PDF] ✅ Text chunking complete - Created ${chunks.length} chunks`);
  console.log(`[PDF] 📊 Chunk sizes: ${chunks.map(chunk => chunk.length).join(', ')}`);
  
  return chunks;
}

export async function getTextFromPDFPages(file, startPage = 1, endPage = null) {
  console.log(`[PDF] 🔄 getTextFromPDFPages - File: ${file.name}, Start page: ${startPage}, End page: ${endPage || 'last'}`);
  
  try {
    console.log(`[PDF] 🔄 Converting file to ArrayBuffer`);
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[PDF] ✅ File converted to ArrayBuffer - Size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
    
    console.log(`[PDF] 🔄 Loading PDF document`);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`[PDF] ✅ PDF loaded - Total pages: ${pdf.numPages}`);
    
    // If endPage is not specified, set it to the last page
    if (!endPage || endPage > pdf.numPages) {
      endPage = pdf.numPages;
      console.log(`[PDF] ℹ️ End page set to last page: ${endPage}`);
    }
    
    let text = '';
    
    console.log(`[PDF] 🔄 Extracting text from pages ${startPage} to ${endPage}`);
    const startExtractTime = performance.now();
    
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      console.log(`[PDF] 🔄 Processing page ${pageNum}/${endPage}`);
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      const pageText = strings.join(' ') + ' ';
      text += pageText;
      console.log(`[PDF] ✅ Page ${pageNum} processed - Text length: ${pageText.length}`);
    }
    
    const endExtractTime = performance.now();
    console.log(`[PDF] ✅ Text extraction complete - Pages: ${endPage - startPage + 1}, Total length: ${text.length}, Time: ${((endExtractTime - startExtractTime) / 1000).toFixed(2)}s`);
    
    return text;
  } catch (error) {
    console.error(`[PDF] ❌ Error extracting text from PDF pages:`, error);
    throw error;
  }
}
