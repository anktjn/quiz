import OpenAI from "openai";
import { chunkText } from "./pdf";
import { storePDFContent, getPDFContent, doesPDFContentExist } from "./pdfService";
import { storeQuizTemplate, hasValidQuizTemplate, generateQuizFromTemplate } from "./quizTemplateService";

console.log('[OPENAI] Initializing OpenAI module');

// Create a simplified OpenAI configuration
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // for frontend usage (development only)
  maxRetries: 3,
  timeout: 60000, // 60-second timeout for all requests
});

console.log('[OPENAI] OpenAI client initialized with API key:', import.meta.env.VITE_OPENAI_API_KEY ? 'PRESENT' : 'MISSING');

/**
 * Helper function to implement exponential backoff for API rate limits
 * @param {Function} apiCallFn - Async function that makes the API call
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<any>} - Result from the API call
 */
async function withRateLimitRetry(apiCallFn, maxRetries = 5, initialDelay = 1000) {
  let retryCount = 0;
  let lastError = null;
  let delay = initialDelay;

  while (retryCount <= maxRetries) {
    try {
      return await apiCallFn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.status === 429) {
        retryCount++;
        
        if (retryCount > maxRetries) {
          console.error(`[OPENAI] ❌ Rate limit retry attempts exhausted (${maxRetries})`);
          break;
        }
        
        // Exponential backoff with jitter
        delay = Math.min(delay * 2, 60000) * (0.8 + Math.random() * 0.4);
        
        console.log(`[OPENAI] ⏱️ Rate limit hit, retrying in ${Math.round(delay/1000)}s (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // For other errors, don't retry
        throw error;
      }
    }
  }
  
  // If we got here, we've exhausted our retries
  throw lastError || new Error("API call failed after multiple retries");
}

export async function generateSummaryFromChunk(chunkText) {
  console.log(`[OPENAI] 🔄 generateSummaryFromChunk - Starting - Chunk length: ${chunkText.length}`);
  
  // Create an AbortController to handle timeouts
  const controller = new AbortController();
  let timeoutId = null;
  
  // Define abortOnUnload upfront to prevent ReferenceError
  const abortOnUnload = () => {
    console.log("[OPENAI] 🛑 Summary generation aborted due to page unload");
    if (controller) {
      controller.abort();
    }
  };
  
  try {
    console.log(`[OPENAI] 📝 Generating summary for chunk of length: ${chunkText.length}`);
    console.log(`[OPENAI] 📝 First 100 chars of chunk: "${chunkText.substring(0, 100)}..."`);
    
    // Set timeout to abort after 60 seconds
    timeoutId = setTimeout(() => {
      console.log("[OPENAI] ⏱️ Timeout reached for summary generation, aborting request");
      controller.abort();
    }, 60000);
    
    // Add event listener for unload events to abort any pending requests
    window.addEventListener('beforeunload', abortOnUnload);
    
    console.log("[OPENAI] 🔄 Preparing OpenAI chat.completions.create call");
    console.log("[OPENAI] 📤 Using model: gpt-3.5-turbo");
    
    const startTime = performance.now();
    console.log(`[OPENAI] ⏱️ API call started at: ${new Date().toISOString()}`);
    
    // Use our retry function for the API call
    const response = await withRateLimitRetry(async () => {
      return await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "user", 
          content: `Please create a concise summary of the following text, capturing all key concepts, facts, and important information: ${chunkText}`
        }
      ],
      max_tokens: 800,
      }, {
        signal: controller.signal,
        timeout: 60000 // Move timeout to the request options object
      });
    });
    
    const endTime = performance.now();
    console.log(`[OPENAI] ⏱️ API call finished at: ${new Date().toISOString()}`);
    console.log(`[OPENAI] ⏱️ API call took ${(endTime - startTime).toFixed(2)}ms`);
    
    console.log(`[OPENAI] ✅ Successfully generated summary - Response:`, response);
    console.log(`[OPENAI] 📊 Summary length: ${response.choices[0].message.content.length}`);
    console.log(`[OPENAI] 📊 First 100 chars of summary: "${response.choices[0].message.content.substring(0, 100)}..."`);
    console.log(`[OPENAI] 🏁 CHUNK COMPLETE - Successfully processed chunk of length ${chunkText.length}`);
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error(`[OPENAI] ❌ Error in generateSummaryFromChunk:`, error);
    
    // Handle APIUserAbortError specifically
    if (error.name === 'APIUserAbortError') {
      console.error("[OPENAI] ❌ Request was aborted by the user or program:", error);
      return chunkText.substring(0, 800) + "... (summary generation aborted)";
    }
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      console.error("[OPENAI] ❌ Timeout generating summary, falling back to truncated original text");
      // Fallback to a truncated version of the original text
      return chunkText.substring(0, 800) + "... (summary generation timed out)";
    }
    
    // New handling specifically for rate limit errors that couldn't be resolved with retries
    if (error.status === 429) {
      console.error("[OPENAI] ❌ Rate limit error after retries, falling back to original text");
      return chunkText.substring(0, 800) + "... (summary generation rate limited)";
    }
    
    console.error("[OPENAI] ❌ Error generating summary:", error);
    console.error("[OPENAI] ❌ Error details:", {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    
    // Return a portion of the original text as fallback
    return chunkText.substring(0, 800) + "... (summary generation failed)";
  } finally {
    // Cleanup to avoid memory leaks
    if (timeoutId) {
      console.log("[OPENAI] 🧹 Clearing timeout");
      clearTimeout(timeoutId);
    }
    console.log("[OPENAI] 🧹 Removing beforeunload event listener");
    window.removeEventListener('beforeunload', abortOnUnload);
    console.log(`[OPENAI] ✅ generateSummaryFromChunk - Finished`);
  }
}

/**
 * Extract content from PDF for quiz generation with optimization
 * @param {string} pdfText - Raw text from PDF
 * @param {string} pdfId - PDF ID for caching
 * @returns {Promise<Object>} Processed content for quiz generation 
 */
export async function processPDFContent(pdfText, pdfId) {
  console.log(`[OPENAI] 🔄 processPDFContent - Starting - PDF ID: ${pdfId || 'Not provided'}`);
  
  try {
    console.log(`[OPENAI] 📝 Processing PDF content - PDF length: ${pdfText ? pdfText.length : 0}`);
    
    if (!pdfText) {
      console.error("[OPENAI] ❌ No text provided for processing");
      throw new Error("PDF text is required");
    }
    
    // Initialize processed chunks array
    let processedChunks = [];
    
    // Check if we already have processed content
    if (pdfId) {
      console.log(`[OPENAI] 🔍 Checking for cached content for PDF ID: ${pdfId}`);
      try {
        const existingContent = await getPDFContent(pdfId);
        if (existingContent) {
          console.log(`[OPENAI] ✅ Found cached PDF content for PDF ID: ${pdfId}`);
          console.log(`[OPENAI] 📊 Cached content length: ${existingContent.extracted_text.length}`);
          
          // Detect if the content is just test data (less than 100 chars or contains the test marker)
          const isTestData = existingContent.extracted_text.length < 100 || 
                            existingContent.extracted_text.includes("Test content for PDF storage verification");
                            
          if (isTestData) {
            console.log(`[OPENAI] ⚠️ Detected test data in cached content, will process fresh content`);
          } else {
            // Parse any existing chunks if available
            let cachedChunks = [];
            if (existingContent.chunks) {
              try {
                cachedChunks = JSON.parse(existingContent.chunks);
                console.log(`[OPENAI] 📊 Parsed ${cachedChunks.length} chunks from cached content`);
                
                // Check if these are already chapter-based chunks (look for chapter metadata)
                const hasChapterMetadata = cachedChunks.some(chunk => 
                  chunk && chunk.metadata && (chunk.metadata.chapter || chunk.metadata.chapterTitle)
                );
                
                if (hasChapterMetadata) {
                  console.log(`[OPENAI] ✅ Found chapter-based chunks in cache, will use these`);
                  return { 
                    content: existingContent.extracted_text, 
                    chunks: cachedChunks 
                  };
                } else {
                  console.log(`[OPENAI] 🔄 Cached chunks don't have chapter metadata, will re-process`);
                }
              } catch (parseError) {
                console.error(`[OPENAI] ❌ Error parsing cached chunks: ${parseError.message}`);
                // Continue with new processing if parsing fails
              }
            }
          }
        }
        console.log(`[OPENAI] 🔍 No cached content found or needs reprocessing`);
      } catch (cacheError) {
        console.error(`[OPENAI] ❌ Error retrieving cached content: ${cacheError.message}`, cacheError);
        // Continue with processing rather than failing
      }
    }

    // Detect chapters or sections in the PDF text
    console.log(`[OPENAI] 📚 Analyzing text for chapter structure`);
    
    // Common chapter detection patterns
    const chapterPatterns = [
      { pattern: /\n\s*(chapter|section)\s+(\d+|[ivxlcdm]+)[\s\n:]+/gi, format: 'standard' },
      { pattern: /\n\s*(\d+|[ivxlcdm]+)\.\s+/gi, format: 'numbered' },
      { pattern: /\n\s*[*-]{3,}\s*\n\s*(.+?)\s*\n\s*[*-]{3,}\s*\n/gi, format: 'decorated' },
      { pattern: /\n\s*(\d+|[ivxlcdm]+)\s*\n/gi, format: 'minimal' }
    ];
    
    // Find possible chapter breaks
    let chapterMatches = [];
    
    for (const {pattern, format} of chapterPatterns) {
      let match;
      // Reset pattern for each use
      const resetPattern = new RegExp(pattern.source, pattern.flags);
      
      while ((match = resetPattern.exec(pdfText)) !== null) {
        const position = match.index;
        const fullMatch = match[0];
        let title = '';
        
        // Extract the chapter title based on format
        switch (format) {
          case 'standard':
            title = fullMatch.trim();
            break;
          case 'numbered':
            title = `Chapter ${match[1]}`;
            break;
          case 'decorated':
            title = match[1] || 'Chapter';
            break;
          case 'minimal':
            title = `Chapter ${match[1]}`;
            break;
          default:
            title = `Chapter at position ${position}`;
        }
        
        chapterMatches.push({ position, title, format });
      }
    }
    
    // Sort by position in document
    chapterMatches.sort((a, b) => a.position - b.position);
    
    // Filter out too-close matches (likely false positives)
    const MIN_CHAPTER_LENGTH = 500; // Minimum characters for a realistic chapter
    let chapters = [];
    let lastPosition = -1;
    
    chapterMatches.forEach(match => {
      if (lastPosition === -1 || match.position - lastPosition >= MIN_CHAPTER_LENGTH) {
        chapters.push(match);
        lastPosition = match.position;
      }
    });
    
    console.log(`[OPENAI] 📚 Detected ${chapters.length} potential chapters/sections`);
    
    // Process by chapters if found, otherwise chunk by size
    if (chapters.length > 0) {
      console.log(`[OPENAI] 🔄 Processing content by chapters`);
      
      // For each chapter, create chunks
      for (let i = 0; i < chapters.length; i++) {
        const chapterStart = chapters[i].position;
        const chapterEnd = i < chapters.length - 1 ? chapters[i + 1].position : pdfText.length;
        const chapterText = pdfText.substring(chapterStart, chapterEnd);
        
        // Clean up chapter title 
        let chapterTitle = chapters[i].title.replace(/[\n\r]+/g, ' ').trim();
        if (chapterTitle.length > 50) {
          chapterTitle = chapterTitle.substring(0, 47) + '...';
        }
        
        console.log(`[OPENAI] 📝 Processing chapter: ${chapterTitle} (${chapterText.length} chars)`);
        
        // If chapter is very long, split into subchunks but maintain chapter association
        const MAX_CHUNK_SIZE = 4000;
        
        if (chapterText.length > MAX_CHUNK_SIZE) {
          const subChunks = chunkText(chapterText, MAX_CHUNK_SIZE);
          console.log(`[OPENAI] 🔪 Split chapter into ${subChunks.length} chunks`);
          
          subChunks.forEach((subChunk, subIndex) => {
            processedChunks.push({
              index: processedChunks.length,
              text: subChunk,
              metadata: {
                chapter: i + 1,
                chapterTitle: chapterTitle,
                subSection: subIndex + 1,
                totalSubSections: subChunks.length,
                importance: "high" // All original content is considered high importance
              }
            });
          });
        } else {
          // For smaller chapters, keep as one chunk
          processedChunks.push({
            index: processedChunks.length,
            text: chapterText,
            metadata: {
              chapter: i + 1,
              chapterTitle: chapterTitle,
              importance: "high"
            }
          });
        }
      }
    } else {
      // No chapters detected, use size-based chunking
      console.log(`[OPENAI] 📄 No chapter structure detected, chunking by size`);
      
      const MAX_CHUNK_SIZE = 4000;
      const chunks = chunkText(pdfText, MAX_CHUNK_SIZE);
      
      chunks.forEach((chunk, index) => {
        processedChunks.push({
          index: index,
          text: chunk,
          metadata: {
            section: index + 1,
            totalSections: chunks.length,
            chapterTitle: `Section ${index + 1}`,
            importance: "high"
          }
        });
      });
      
      console.log(`[OPENAI] 📊 Created ${chunks.length} size-based chunks`);
    }
    
    // Use the first ~100k chars of the original text as the content for storage
    // This is for compatibility with existing functionality while we transition to chunk-based
    let contentForStorage = "";
    if (pdfText.length <= 100000) {
      contentForStorage = pdfText;
    } else {
      contentForStorage = pdfText.substring(0, 100000) + 
        `\n\n[Note: This text has been truncated for storage. Full content available in chunks. Original length: ${pdfText.length} characters]`;
    }
    
    console.log(`[OPENAI] 📦 Prepared ${processedChunks.length} chunks for storage`);
    
    // Store the processed content for future use
    if (pdfId) {
      try {
        console.log(`[OPENAI] 💾 Storing processed content for PDF ID: ${pdfId}`);
        console.log(`[OPENAI] 📊 Content length to store: ${contentForStorage.length}, Chunks: ${processedChunks.length}`);
        
        const storeStartTime = performance.now();
        await storePDFContent(pdfId, contentForStorage, processedChunks);
        const storeEndTime = performance.now();
        
        console.log(`[OPENAI] ⏱️ Content storage took ${(storeEndTime - storeStartTime).toFixed(2)}ms`);
        console.log(`[OPENAI] ✅ Successfully stored processed content`);
        console.log(`[OPENAI] 🏁 CONTENT STORAGE COMPLETE - Content saved to database`);
      } catch (storeError) {
        console.error(`[OPENAI] ❌ Error storing processed content: ${storeError.message}`, storeError);
        // Continue despite storage error
      }
    }
    
    console.log(`[OPENAI] ✅ PDF content processing complete - Chunks: ${processedChunks.length}`);
    return { content: contentForStorage, chunks: processedChunks };
  } catch (error) {
    console.error(`[OPENAI] ❌ Error in processPDFContent:`, error);
    throw error;
  } finally {
    console.log(`[OPENAI] 🔄 processPDFContent - Finished`);
  }
}

/**
 * Generate quiz questions from PDF text
 * @param {string} pdfText - Raw text from PDF
 * @param {string} pdfId - PDF ID for caching
 * @param {boolean} forceRefresh - Whether to force regeneration of questions
 * @param {number} questionsCount - Number of questions to generate
 * @returns {Promise<Object>} Generated quiz questions and metadata
 */
export async function generateQuizQuestions(pdfText, pdfId = null, forceRefresh = false, questionsCount = 50) {
  console.log(`[OPENAI] 🔄 generateQuizQuestions - Starting - PDF ID: ${pdfId || 'Not provided'}, Force refresh: ${forceRefresh}, Questions count: ${questionsCount}`);
  
  try {
    // Initialize variables
    let processedChunks = [];
    let chapterInfo = {};
    
    if (!pdfText) {
      console.error("[OPENAI] ❌ No text provided for quiz generation");
      throw new Error("PDF text is required");
    }
    
    // Validate the API key is available
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      console.error("[OPENAI] ❌ Missing OpenAI API key");
      throw new Error("OpenAI API key is not configured");
    }
    
    console.log(`[OPENAI] 📏 PDF text length for quiz generation: ${pdfText.length}`);
    
    // Check for existing quiz template
    if (pdfId && !forceRefresh) {
      console.log(`[OPENAI] 🔍 Checking for existing quiz template for PDF ID: ${pdfId}`);
      try {
      const hasTemplate = await hasValidQuizTemplate(pdfId);
      if (hasTemplate) {
          console.log(`[OPENAI] ✅ Found quiz template for PDF ID: ${pdfId}. Generating quiz from template.`);
          // Generate quiz from template with randomized indices
          const result = await generateQuizFromTemplate(pdfId, 10);
          console.log(`[OPENAI] 🏁 TEMPLATE RETRIEVAL COMPLETE - Quiz generated from template with indices: ${JSON.stringify(result.selectedIndices || [])}`);
          return result;
        }
        console.log(`[OPENAI] 🔍 No quiz template found, will generate new quiz`);
      } catch (templateError) {
        console.error(`[OPENAI] ❌ Error checking for quiz template: ${templateError.message}`, templateError);
        // Continue with processing rather than failing
      }
    } else if (forceRefresh) {
      console.log(`[OPENAI] 🔄 Force refresh requested, will generate new quiz`);
    }
    
    // Process PDF content to prepare for quiz generation
    console.log(`[OPENAI] 🔄 Processing PDF content for quiz generation`);
    const processedResult = await processPDFContent(pdfText, pdfId);
    processedChunks = processedResult.chunks || [];
    console.log(`[OPENAI] ✅ Content processed with ${processedChunks.length} chunks`);
    
    // Validate that the processed content is substantial enough
    if (!processedChunks || processedChunks.length === 0) {
      console.error(`[OPENAI] ❌ No valid chunks to generate questions from`);
      throw new Error("The processed content is not sufficient to generate quiz questions.");
    }
    
    // Set progress status
    const progressEvent = new CustomEvent('quiz-generation-progress', {
      detail: { message: "Creating quiz questions..." }
    });
    window.dispatchEvent(progressEvent);
    console.log(`[OPENAI] 📣 Emitted quiz-generation-progress event: Creating quiz questions`);
    
    // Generate questions from individual chunks
    console.log(`[OPENAI] 🧩 Preparing to generate questions from ${processedChunks.length} chunks`);
    
    // Determine how many chunks to use and questions per chunk
    const MAX_CHUNKS_TO_PROCESS = 10; // Limit to avoid excessive API calls
    const questionsPerChunk = Math.max(3, Math.min(8, Math.ceil(questionsCount / Math.min(processedChunks.length, MAX_CHUNKS_TO_PROCESS))));
    
    let chunksToUse;
    if (processedChunks.length > MAX_CHUNKS_TO_PROCESS) {
      console.log(`[OPENAI] 🔍 Selecting ${MAX_CHUNKS_TO_PROCESS} most important chunks from ${processedChunks.length} total chunks`);
      
      // Build chapter coverage - ensure we select at least one chunk from each chapter if possible
      const chapterCoverage = new Map();
        processedChunks.forEach(chunk => {
        if (chunk.metadata && chunk.metadata.chapter) {
          if (!chapterCoverage.has(chunk.metadata.chapter)) {
            chapterCoverage.set(chunk.metadata.chapter, []);
          }
          chapterCoverage.get(chunk.metadata.chapter).push(chunk);
        }
      });
      
      // Get representative chunks from each chapter, prioritizing smaller chapters
      let selectedChunks = [];
      
      // First, ensure we have at least one chunk from each chapter
      for (const [chapter, chunks] of chapterCoverage.entries()) {
        // If the chapter is small enough, add a representative chunk
        const representativeChunk = chunks.length > 3 ? 
          chunks[Math.floor(chunks.length / 2)] : // Middle chunk for larger chapters
          chunks[0]; // First chunk for smaller chapters
        
        selectedChunks.push(representativeChunk);
        
        // Store chapter information for metadata
        chapterInfo[chapter] = {
          title: representativeChunk.metadata.chapterTitle || `Chapter ${chapter}`,
          chunkCount: chunks.length
        };
      }
      
      // If we haven't reached MAX_CHUNKS_TO_PROCESS yet, add more chunks
      if (selectedChunks.length < MAX_CHUNKS_TO_PROCESS) {
        // Sort remaining chunks by size (prefer longer chunks for question generation)
        const remainingChunks = processedChunks.filter(chunk => 
          !selectedChunks.some(selected => selected.index === chunk.index)
        ).sort((a, b) => b.text.length - a.text.length);
        
        // Add remaining chunks until we reach MAX_CHUNKS_TO_PROCESS
        selectedChunks = [
          ...selectedChunks,
          ...remainingChunks.slice(0, MAX_CHUNKS_TO_PROCESS - selectedChunks.length)
        ];
      }
      
      // Sort chunks by their original position in the document
      chunksToUse = selectedChunks.sort((a, b) => a.index - b.index);
      console.log(`[OPENAI] 📊 Selected ${chunksToUse.length} chunks for question generation`);
    } else {
      // Use all chunks if we have fewer than MAX_CHUNKS_TO_PROCESS
      chunksToUse = processedChunks;
      console.log(`[OPENAI] 📊 Using all ${chunksToUse.length} chunks for question generation`);
      
      // Build chapter info
      processedChunks.forEach(chunk => {
        if (chunk.metadata && chunk.metadata.chapter) {
          const chapter = chunk.metadata.chapter;
          if (!chapterInfo[chapter]) {
            chapterInfo[chapter] = {
              title: chunk.metadata.chapterTitle || `Chapter ${chapter}`,
              chunkCount: 1
            };
          } else {
            chapterInfo[chapter].chunkCount++;
          }
        }
      });
    }
    
    // Generate questions from selected chunks
    console.log(`[OPENAI] 🧠 Generating ${questionsPerChunk} questions per chunk for ${chunksToUse.length} chunks`);
    
    // Array to store all generated questions
    let allQuestions = [];
    
    // Process chunks with controlled concurrency
    const BATCH_SIZE = 2; // Process 2 chunks at a time
    const DELAY_BETWEEN_BATCHES = 1500; // 1.5 second between batches
    
    for (let i = 0; i < chunksToUse.length; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, chunksToUse.length);
      console.log(`[OPENAI] 🔄 Processing batch of chunks ${i+1} to ${batchEnd} of ${chunksToUse.length}`);
      
      const batchPromises = [];
      for (let j = i; j < batchEnd; j++) {
        const chunk = chunksToUse[j];
        
        batchPromises.push((async () => {
          try {
            // Emit a progress event for UI updates
            const progressEvent = new CustomEvent('chunk-processing', {
              detail: { 
                current: j + 1, 
                total: chunksToUse.length 
              }
            });
            window.dispatchEvent(progressEvent);
            
            // Prepare chunk information for prompt
            const chunkInfo = chunk.metadata || {};
            const chapterText = chunkInfo.chapter ? 
              `from Chapter ${chunkInfo.chapter}: "${chunkInfo.chapterTitle || ''}"` : 
              `from Section ${chunkInfo.section || chunk.index + 1}`;
              
            console.log(`[OPENAI] 🔄 Generating questions ${chapterText}`);
            
            // Generate questions for this chunk
            const response = await withRateLimitRetry(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4", // Use the more capable model for quiz generation
          messages: [
            {
              role: "system",
              content: `You are an expert quiz creator that creates multiple-choice questions based on text content. 
                    Create ${questionsPerChunk} educational multiple-choice questions ${chapterText}.
              Each question should have 4 answer choices with only one correct answer. 
                    Questions should be diverse and test understanding of key concepts in the text.
              You MUST always respond with properly formatted JSON with a 'questions' array, NEVER plain text.
              Format your response as a JSON object with this exact structure:
      {
        "questions": [
          {
                    "question": "Question text here",
                    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                    "answer": 0,
                    "explanation": "Explanation for why the answer is correct"
                  },
                  ...more questions...
                ]
              }
                    The "answer" must be the index (0-3) of the correct option in the options array.`
                  },
                  { role: "user", content: chunk.text }
          ],
          temperature: 0.7,
                max_tokens: 1500,
        });
      }, 5, 2000); // 5 retries, starting with 2-second delay
            
            // Parse questions from response
            let chunkQuestions = [];
            try {
              const content = response.choices[0].message.content;
              
              // Try to extract JSON from the response
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              const jsonContent = jsonMatch ? jsonMatch[0] : content;
              
              // Parse the JSON and extract questions
              const parsed = JSON.parse(jsonContent);
              
              if (parsed.questions && Array.isArray(parsed.questions)) {
                // Add metadata to each question
                chunkQuestions = parsed.questions.map(q => ({
                  ...q,
                  metadata: {
                    chapter: chunkInfo.chapter,
                    chapterTitle: chunkInfo.chapterTitle,
                    section: chunkInfo.section || chunkInfo.subSection || chunk.index + 1
                  }
                }));
                
                console.log(`[OPENAI] ✅ Generated ${chunkQuestions.length} questions for chunk ${j+1}`);
              } else {
                console.warn(`[OPENAI] ⚠️ Invalid question format in response for chunk ${j+1}`);
              }
            } catch (parseError) {
              console.error(`[OPENAI] ❌ Error parsing questions for chunk ${j+1}:`, parseError);
              console.error(`[OPENAI] ❌ Raw content:`, response.choices[0].message.content.substring(0, 200) + '...');
            }
            
            return chunkQuestions;
          } catch (error) {
            console.error(`[OPENAI] ❌ Error generating questions for chunk ${j+1}:`, error);
            return [];
          }
        })());
      }
      
      // Wait for all chunks in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add questions from this batch to our collection
      batchResults.forEach(questions => {
        allQuestions.push(...questions);
      });
      
      console.log(`[OPENAI] ✅ Batch ${i+1}-${batchEnd} completed, total questions so far: ${allQuestions.length}`);
      
      // Add delay between batches if we're not at the end
      if (batchEnd < chunksToUse.length) {
        console.log(`[OPENAI] ⏱️ Delaying ${DELAY_BETWEEN_BATCHES}ms before next batch`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    console.log(`[OPENAI] 🎉 Generated a total of ${allQuestions.length} questions from all chunks`);
    
    // Ensure we have useful questions
    if (allQuestions.length === 0) {
      console.error(`[OPENAI] ❌ Failed to generate any valid questions, falling back to legacy approach`);
      
      // TODO: If needed, implement fallback to legacy approach here
      throw new Error("Failed to generate any valid questions. Please try again or try with a different document.");
    }
    
    // Deduplicate questions (sometimes the same concept appears in multiple chunks)
    console.log(`[OPENAI] 🧹 Deduplicating questions`);
    
    const uniqueQuestions = [];
    const seenQuestions = new Set();
    
    allQuestions.forEach(q => {
      // Create a simple hash of the question to detect duplicates
      const questionHash = q.question.toLowerCase().replace(/\s+/g, ' ').trim();
      
      if (!seenQuestions.has(questionHash)) {
        seenQuestions.add(questionHash);
        uniqueQuestions.push(q);
      }
    });
    
    console.log(`[OPENAI] ✅ After deduplication: ${uniqueQuestions.length} unique questions (removed ${allQuestions.length - uniqueQuestions.length} duplicates)`);
    
    // Prepare final questions (use up to questionsCount, if available)
    const finalQuestions = uniqueQuestions.slice(0, questionsCount);
    
    // Create result object with metadata
    const quizData = {
      questions: finalQuestions,
      chapterInfo: chapterInfo,
      generationMethod: 'chunk-based'
    };
      
      // Store the quiz template for future use
    if (pdfId && finalQuestions.length > 0) {
        try {
        console.log(`[OPENAI] 💾 Storing quiz template with ${finalQuestions.length} questions for PDF ID: ${pdfId}`);
          
          const templateStoreStart = performance.now();
        const templateResult = await storeQuizTemplate(pdfId, finalQuestions, "gpt-4", chapterInfo);
          const templateStoreEnd = performance.now();
          
          console.log(`[OPENAI] ⏱️ Quiz template storage took ${(templateStoreEnd - templateStoreStart).toFixed(2)}ms`);
        console.log(`[OPENAI] ✅ Successfully stored quiz template with ID: ${templateResult.id}`);
        
        // Add template ID to the result
        quizData.templateId = templateResult.id;
        
        // Randomize the selected indices instead of sequential
        // Create array of all possible indices
        const allIndices = Array.from({ length: finalQuestions.length }, (_, i) => i);
        
        // Fisher-Yates shuffle algorithm - more reliable than sort with random
        for (let i = allIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]]; // swap elements
        }
        
        // Take the first 10 indices (or fewer if we have fewer questions)
        const count = Math.min(10, finalQuestions.length);
        const selectedIndices = allIndices.slice(0, count);
        
        console.log(`[OPENAI] 🎲 Selected random indices: ${JSON.stringify(selectedIndices)}`);
        
        quizData.selectedIndices = selectedIndices;
        
        // Update quiz questions to include only the selected ones
        if (selectedIndices.length < finalQuestions.length) {
          const selectedQuestions = selectedIndices.map(index => finalQuestions[index]);
          quizData.questions = selectedQuestions;
          console.log(`[OPENAI] ✅ Updated questions array to include only ${selectedQuestions.length} selected questions`);
        }
        } catch (storeError) {
          console.error(`[OPENAI] ❌ Error storing quiz template: ${storeError.message}`, storeError);
        quizData.warning = "Questions generated successfully but template could not be saved for future use";
      }
    }
    
    console.log(`[OPENAI] 🏁 QUIZ GENERATION COMPLETE - Generated ${finalQuestions.length} questions`);
    return quizData;
  } catch (error) {
    console.error("[OPENAI] ❌ Error in generateQuizQuestions:", error);
    
    // Emit an error event that the UI can respond to
    const errorEvent = new CustomEvent('quiz-generation-error', {
      detail: { 
        message: "Quiz generation failed",
        error: error.message 
      }
    });
    window.dispatchEvent(errorEvent);
    
    // Return a structured error response instead of throwing
    return {
      questions: [], 
      error: {
        message: error.message || "An unexpected error occurred",
        timestamp: new Date().toISOString()
      }
    };
  } finally {
    console.log(`[OPENAI] 🔄 generateQuizQuestions - Finished`);
  }
}

// Helper function to extract potential key terms from a chunk of text
function extractKeyTerms(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // A simple implementation that looks for capitalized multi-word phrases and technical terms
  const potentialTerms = [];
  
  // Look for capitalized phrases (simple approach)
  const capitalizedRegex = /[A-Z][a-z]+ [A-Z][a-z]+( [A-Z][a-z]+)*/g;
  const capitalized = text.match(capitalizedRegex) || [];
  potentialTerms.push(...capitalized);
  
  // Extract potential acronyms
  const acronymRegex = /\b[A-Z]{2,}\b/g;
  const acronyms = text.match(acronymRegex) || [];
  potentialTerms.push(...acronyms);
  
  // Return unique terms
  return [...new Set(potentialTerms)].slice(0, 10); // Limit to 10 key terms
}

// Helper function to estimate the importance of a chunk
function calculateChunkImportance(summary) {
  if (!summary || typeof summary !== 'string') {
    return "low";
  }
  
  // A simple heuristic based on summary length and key phrase occurrence
  const importantPhrases = [
    'important', 'significant', 'key', 'critical', 'essential',
    'fundamental', 'main', 'primary', 'crucial', 'vital'
  ];
  
  // Check if summary contains important indicator phrases
  const containsImportantPhrases = importantPhrases.some(phrase => 
    summary.toLowerCase().includes(phrase)
  );
  
  // Longer summaries might indicate more important content
  const isLongSummary = summary.length > 300;
  
  if (containsImportantPhrases && isLongSummary) {
    return "high";
  } else if (containsImportantPhrases || isLongSummary) {
    return "medium";
  } else {
    return "low";
  }
}
