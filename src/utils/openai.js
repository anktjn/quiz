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
 * @returns {Promise<string>} Processed content for quiz generation
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
            // Filter out any error messages that might have been cached
            let cleanContent = existingContent.extracted_text;
            cleanContent = cleanContent.replace(/abortOnUnload is not defined/g, "");
            cleanContent = cleanContent.replace(/Error processing chunk[^\n]*/g, "");
            cleanContent = cleanContent.replace(/summary generation (failed|timed out|aborted)[^\n]*/g, "");
            
            console.log(`[OPENAI] 🧹 Cleaned cached content - Original length: ${existingContent.extracted_text.length}, New length: ${cleanContent.length}`);
            console.log(`[OPENAI] 🏁 CONTENT RETRIEVAL COMPLETE - Using cached content`);
            
            // Parse any existing chunks if available
            let cachedChunks = [];
            if (existingContent.chunks) {
              try {
                cachedChunks = JSON.parse(existingContent.chunks);
                console.log(`[OPENAI] 📊 Parsed ${cachedChunks.length} chunks from cached content`);
              } catch (parseError) {
                console.error(`[OPENAI] ❌ Error parsing cached chunks: ${parseError.message}`);
                // Continue with empty chunks if parsing fails
              }
            }
            
            return { content: cleanContent, chunks: cachedChunks };
          }
        }
        console.log(`[OPENAI] 🔍 No cached content found, will process`);
      } catch (cacheError) {
        console.error(`[OPENAI] ❌ Error retrieving cached content: ${cacheError.message}`, cacheError);
        // Continue with processing rather than failing
      }
    }

    // For large texts, chunk it and create summaries
    const MAX_CONTENT_LENGTH = 15000; // Conservative limit to avoid token issues
    
    let contentForQuiz;
    
    console.log(`[OPENAI] 📊 PDF text length: ${pdfText.length}, threshold: ${MAX_CONTENT_LENGTH}`);
    
    if (pdfText.length > MAX_CONTENT_LENGTH) {
      console.log(`[OPENAI] 📏 Text exceeds maximum length, will chunk and summarize`);
      
      // Split into manageable chunks
      const chunks = chunkText(pdfText, 4000); // Chunk size of ~4000 chars
      console.log(`[OPENAI] 📊 Text split into ${chunks.length} chunks`);
      console.log(`[OPENAI] 📊 First chunk length: ${chunks[0].length}`);
      
      // Generate summaries for each chunk
      const summaries = [];
      
      // Process chunks in batches to prevent overwhelming the browser
      const BATCH_SIZE = 3; // Reduced from 5 to 3 to lower concurrency
      const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
      const DELAY_BETWEEN_CHUNKS = 500; // 0.5 second delay between chunks in a batch
      
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, chunks.length);
        console.log(`[OPENAI] 🔄 Processing batch of chunks ${i+1} to ${batchEnd} of ${chunks.length}`);
        
        // Process this batch with limited concurrency
        const batchPromises = [];
        for (let j = i; j < batchEnd; j++) {
          // Add a small delay between starting each chunk in the batch
          if (j > i) {
            console.log(`[OPENAI] ⏱️ Adding delay between chunks (${DELAY_BETWEEN_CHUNKS}ms)`);
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
          }
          
          batchPromises.push(
            (async (chunkIndex) => {
              console.log(`[OPENAI] 🔄 Starting processing for chunk ${chunkIndex+1}/${chunks.length}`);
              
              // Emit a progress event for UI updates
              const progressEvent = new CustomEvent('chunk-processing', {
                detail: { current: chunkIndex + 1, total: chunks.length }
              });
              window.dispatchEvent(progressEvent);
              console.log(`[OPENAI] 📣 Emitted chunk-processing event for chunk ${chunkIndex+1}/${chunks.length}`);
              
              try {
                console.log(`[OPENAI] 🔄 Generating summary for chunk ${chunkIndex+1}`);
                const summary = await generateSummaryFromChunk(chunks[chunkIndex]);
                console.log(`[OPENAI] ✅ Summary generated for chunk ${chunkIndex+1} - Length: ${summary.length}`);
                
                // Filter out any error messages that might have been included
                let cleanSummary = summary;
                cleanSummary = cleanSummary.replace(/abortOnUnload is not defined/g, "");
                cleanSummary = cleanSummary.replace(/Error processing chunk[^\n]*/g, "");
                cleanSummary = cleanSummary.replace(/summary generation (failed|timed out|aborted|rate limited)[^\n]*/g, "");
                
                // Store more complete information about each chunk for better quiz generation
                const chunkResult = {
                  index: chunkIndex,
                  originalLength: chunks[chunkIndex].length,
                  summaryLength: cleanSummary.length,
                  summary: cleanSummary,
                  originalText: chunks[chunkIndex].substring(0, 1000), // Store beginning of original text for context
                  position: `${chunkIndex + 1} of ${chunks.length}`,
                  keyTerms: extractKeyTerms(chunks[chunkIndex]),
                  importance: calculateChunkImportance(cleanSummary)
                };
                
                console.log(`[OPENAI] ✅ Chunk ${chunkIndex+1} processed successfully with enhanced metadata`);
                return { index: chunkIndex, summary: cleanSummary, chunkResult };
              } catch (error) {
                console.error(`[OPENAI] ❌ Error processing chunk ${chunkIndex+1}:`, error);
                // Return a simplified result for failed chunks
                return { 
                  index: chunkIndex, 
                  summary: `Important content from section ${chunkIndex+1}`,
                  chunkResult: {
                    index: chunkIndex,
                    originalLength: chunks[chunkIndex].length,
                    summaryLength: 0,
                    summary: `Important content from section ${chunkIndex+1}`,
                    originalText: chunks[chunkIndex].substring(0, 200), // Some minimal original text
                    position: `${chunkIndex + 1} of ${chunks.length}`,
                    keyTerms: [],
                    importance: "medium"
                  }
                };
              }
            })(j)
          );
        }
        
        // Wait for this batch to complete
        console.log(`[OPENAI] 🔄 Waiting for batch ${i+1}-${batchEnd} to complete`);
        const batchResults = await Promise.all(batchPromises);
        console.log(`[OPENAI] ✅ Batch ${i+1}-${batchEnd} completed`);
        
        // Add results to our collections in the correct order
        batchResults.forEach(result => {
          console.log(`[OPENAI] 📝 Adding summary for chunk ${result.index+1} to results`);
          summaries[result.index] = result.summary;
          processedChunks[result.index] = result.chunkResult;
        });
        
        // Store batch results to database periodically to avoid losing progress
        if (pdfId && (i + BATCH_SIZE >= chunks.length || (i > 0 && i % 10 === 0))) {
          try {
            console.log(`[OPENAI] 💾 Storing interim results after batch ${i+1}-${batchEnd}`);
            const interimContent = summaries.join("\n\n");
            await storePDFContent(pdfId, interimContent, processedChunks, true);
            console.log(`[OPENAI] ✅ Successfully stored interim results to database`);
          } catch (interimStoreError) {
            console.error(`[OPENAI] ⚠️ Failed to store interim results: ${interimStoreError.message}`, interimStoreError);
            // Continue processing despite storage error
          }
        }
        
        // Larger delay between batches to avoid rate limits
        if (batchEnd < chunks.length) {
          console.log(`[OPENAI] ⏱️ Adding delay between batches (${DELAY_BETWEEN_BATCHES}ms)`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
      
      // Combine summaries
      contentForQuiz = summaries.join("\n\n");
      console.log(`[OPENAI] 📊 Combined summaries length: ${contentForQuiz.length}`);
      
      // If combined summaries are still too large, summarize again
      if (contentForQuiz.length > MAX_CONTENT_LENGTH) {
        console.log(`[OPENAI] 📏 Combined summaries still exceed maximum length (${contentForQuiz.length} > ${MAX_CONTENT_LENGTH}), performing second-level summarization`);
        const secondLevelChunks = chunkText(contentForQuiz, 4000);
        console.log(`[OPENAI] 📊 Created ${secondLevelChunks.length} second-level chunks`);
        
        const secondLevelSummaries = [];
        
        for (let i = 0; i < secondLevelChunks.length; i++) {
          console.log(`[OPENAI] 🔄 Processing second-level chunk ${i+1}/${secondLevelChunks.length}`);
          
          // Emit a progress event for UI updates for second-level processing
          const progressEvent = new CustomEvent('chunk-processing', {
            detail: { 
              current: i + 1, 
              total: secondLevelChunks.length,
              level: 'secondary'
            }
          });
          window.dispatchEvent(progressEvent);
          
          try {
            console.log(`[OPENAI] 🔄 Generating summary for second-level chunk ${i+1}`);
            const secondLevelSummary = await generateSummaryFromChunk(secondLevelChunks[i]);
            // Clean the summary
            let cleanSummary = secondLevelSummary;
            cleanSummary = cleanSummary.replace(/abortOnUnload is not defined/g, "");
            cleanSummary = cleanSummary.replace(/Error processing chunk[^\n]*/g, "");
            cleanSummary = cleanSummary.replace(/summary generation (failed|timed out|aborted)[^\n]*/g, "");
            
            secondLevelSummaries.push(cleanSummary);
            console.log(`[OPENAI] ✅ Summary generated for second-level chunk ${i+1} - Length: ${cleanSummary.length}`);
          } catch (error) {
            console.error(`[OPENAI] ❌ Error processing second-level chunk ${i+1}:`, error);
            secondLevelSummaries.push(`Important content from section ${i+1}`);
          }
        }
        
        contentForQuiz = secondLevelSummaries.join("\n\n");
        console.log(`[OPENAI] 📊 Combined second-level summaries length: ${contentForQuiz.length}`);
      }
    } else {
      // For smaller PDFs, use the original text
      console.log(`[OPENAI] 📏 Text is within length limit, using original`);
      contentForQuiz = pdfText;
      
      // Create a single chunk for the entire text to ensure we have chunk data available
      processedChunks = [{
        index: 0,
        originalLength: pdfText.length,
        summaryLength: pdfText.length,
        summary: pdfText.substring(0, 1000) + "...", // Short excerpt as summary
        originalText: pdfText.substring(0, 1000), // Store beginning as sample
        position: "Full document",
        keyTerms: extractKeyTerms(pdfText),
        importance: "high" // Mark as high importance since it's the entire document
      }];
      
      console.log(`[OPENAI] 📊 Created a single chunk for the entire document`);
    }
    
    // Final cleaning of content to remove any error messages
    contentForQuiz = contentForQuiz.replace(/abortOnUnload is not defined/g, "");
    contentForQuiz = contentForQuiz.replace(/Error processing chunk[^\n]*/g, "");
    contentForQuiz = contentForQuiz.replace(/summary generation (failed|timed out|aborted)[^\n]*/g, "");
    console.log(`[OPENAI] 🧹 Final content cleaning complete`);
    
    // Store the processed content for future use
    if (pdfId) {
      try {
        console.log(`[OPENAI] 💾 Storing processed content for PDF ID: ${pdfId}`);
        console.log(`[OPENAI] 📊 Content length to store: ${contentForQuiz.length}`);
        
        const storeStartTime = performance.now();
        await storePDFContent(pdfId, contentForQuiz, processedChunks);
        const storeEndTime = performance.now();
        
        console.log(`[OPENAI] ⏱️ Content storage took ${(storeEndTime - storeStartTime).toFixed(2)}ms`);
        console.log(`[OPENAI] ✅ Successfully stored processed content`);
        console.log(`[OPENAI] 🏁 CONTENT STORAGE COMPLETE - Content saved to database`);
      } catch (storeError) {
        console.error(`[OPENAI] ❌ Error storing processed content: ${storeError.message}`, storeError);
        // Continue despite storage error
      }
    }
    
    console.log(`[OPENAI] ✅ PDF content processing complete - Final length: ${contentForQuiz.length}`);
    return { content: contentForQuiz, chunks: processedChunks };
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
export async function generateQuizQuestions(pdfText, pdfId = null, forceRefresh = false, questionsCount = 10) {
  console.log(`[OPENAI] 🔄 generateQuizQuestions - Starting - PDF ID: ${pdfId || 'Not provided'}, Force refresh: ${forceRefresh}, Questions count: ${questionsCount}`);
  
  try {
    // Initialize processedChunks variable
    let processedChunks = [];
    
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
          const result = await generateQuizFromTemplate(pdfId, questionsCount);
          console.log(`[OPENAI] 🏁 TEMPLATE RETRIEVAL COMPLETE - Quiz generated from template`);
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
    let processedContent = processedResult.content;
    processedChunks = processedResult.chunks || [];
    console.log(`[OPENAI] ✅ Content processed - Length: ${processedContent.length}, Chunks: ${processedChunks.length}`);
    
    // Validate that the processed content is substantial enough for quiz generation
    const MIN_CONTENT_LENGTH = 500; // Minimum number of characters required
    const MIN_WORD_COUNT = 100; // Minimum number of words required
    
    if (!processedContent || processedContent.length < MIN_CONTENT_LENGTH) {
      console.error(`[OPENAI] ❌ Processed content is too short (${processedContent ? processedContent.length : 0} chars)`);
      console.error(`[OPENAI] ❌ Minimum required: ${MIN_CONTENT_LENGTH} chars`);
      throw new Error("The processed content is not sufficient to generate quiz questions. Please use a PDF with more text content.");
    }
    
    // Count words to ensure there's enough meaningful content
    const wordCount = processedContent.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < MIN_WORD_COUNT) {
      console.error(`[OPENAI] ❌ Processed content has too few words (${wordCount} words)`);
      console.error(`[OPENAI] ❌ Minimum required: ${MIN_WORD_COUNT} words`);
      throw new Error("The PDF doesn't contain enough meaningful text to generate a quiz. Please try a different document.");
    }
    
    // Log content stats to help with debugging
    console.log(`[OPENAI] 📊 Content stats - Length: ${processedContent.length} chars, Words: ${wordCount}`);
    
    // Enhanced cleaning to ensure no error messages are included
    const errorMessages = [
      "abortOnUnload is not defined",
      "Error processing chunk",
      "summary generation failed",
      "summary generation timed out", 
      "summary generation aborted"
    ];
    
    // Clean the content
    processedContent = processedContent.replace(/abortOnUnload is not defined/g, "");
    processedContent = processedContent.replace(/Error processing chunk[^\n]*/g, "");
    processedContent = processedContent.replace(/summary generation (failed|timed out|aborted)[^\n]*/g, "");
    
    // Additional error message pattern removal
    processedContent = processedContent.replace(/TypeError:[^\n]*/g, ""); 
    processedContent = processedContent.replace(/ReferenceError:[^\n]*/g, "");
    processedContent = processedContent.replace(/Error:[^\n]*/g, "");
    
    // Calculate the content after cleaning for logging
    const cleanedLength = processedContent.length;
    console.log(`[OPENAI] 🧹 Cleaned processed content - Length after cleaning: ${cleanedLength}`);
    
    // Check if content still contains error messages
    const hasErrorMessages = errorMessages.some(msg => processedContent.includes(msg));
    if (hasErrorMessages) {
      console.error(`[OPENAI] ❌ Processed content still contains error messages after cleaning`);
      console.error(`[OPENAI] ❌ Content sample: ${processedContent.substring(0, 200)}...`);
      
      // Remove any obvious error sections from the content before continuing
      const contentLines = processedContent.split('\n');
      const filteredLines = contentLines.filter(line => 
        !errorMessages.some(errMsg => line.includes(errMsg)) &&
        !line.includes("TypeError:") && 
        !line.includes("ReferenceError:") &&
        !line.includes("Error:")
      );
      
      processedContent = filteredLines.join('\n');
      console.log(`[OPENAI] 🧹 Performed additional line filtering - New length: ${processedContent.length}`);
      
      // If the content is too short after filtering, throw an error
      if (processedContent.length < 100) {
        throw new Error("The PDF content contains too many error messages and cannot be used to generate a quiz");
      }
    }
    
    // Take a sample of the processed content to verify it's useful
    const contentSample = processedContent.substring(0, 200);
    console.log(`[OPENAI] 📄 Content sample for quiz generation: "${contentSample}..."`);
    
    // Set progress status
    const progressEvent = new CustomEvent('quiz-generation-progress', {
      detail: { message: "Creating quiz questions..." }
    });
    window.dispatchEvent(progressEvent);
    console.log(`[OPENAI] 📣 Emitted quiz-generation-progress event: Creating quiz questions`);
    
    console.log("[OPENAI] 🔄 Preparing OpenAI chat.completions.create call for quiz generation");
    console.log("[OPENAI] 📤 Using model: gpt-4");
    
    const startTime = performance.now();
    console.log(`[OPENAI] ⏱️ Quiz generation API call started at: ${new Date().toISOString()}`);
    
    // Create an AbortController for this request
    const controller = new AbortController();
    
    // Extract important information from stored chunks if available
    let importantTerms = [];
    let importantSections = [];
    
    if (processedChunks && Array.isArray(processedChunks) && processedChunks.length > 0) {
      console.log(`[OPENAI] 📊 Processing ${processedChunks.length} chunks for key information`);
      
      try {
        // Get key terms from high and medium importance chunks
        processedChunks.forEach(chunk => {
          if (!chunk) return;
          
          // Handle different possible structures of chunks
          // Sometimes chunks might be wrapped in a different structure
          const chunkData = chunk.chunkResult || chunk;
          
          // Safe property access with fallbacks
          const importance = chunkData.importance || "low";
          const keyTerms = chunkData.keyTerms || [];
          const originalText = chunkData.originalText || "";
          const position = chunkData.position || `Chunk ${chunkData.index || 0}`;
          
          if (importance === "high" || importance === "medium") {
            if (Array.isArray(keyTerms) && keyTerms.length) {
              importantTerms.push(...keyTerms);
            }
            
            if (importance === "high" && originalText) {
              // Include brief snippets from highly important sections
              const excerpt = typeof originalText === 'string' ? 
                originalText.substring(0, Math.min(300, originalText.length)) : 
                "Important section";
              
              importantSections.push(`From section ${position}: "${excerpt}..."`);
            }
          }
        });
        
        // Deduplicate terms
        importantTerms = [...new Set(importantTerms)].filter(term => term && typeof term === 'string');
        console.log(`[OPENAI] 📊 Extracted ${importantTerms.length} key terms and ${importantSections.length} important sections`);
      } catch (extractionError) {
        console.error(`[OPENAI] ❌ Error extracting important information from chunks: ${extractionError.message}`);
        // Continue with empty arrays if extraction fails
        importantTerms = [];
        importantSections = [];
      }
    } else {
      console.log(`[OPENAI] ℹ️ No chunks available for key information extraction or invalid structure`);
    }
    
    // Generate quiz questions using OpenAI, with improved prompt for JSON formatting
    console.log("[OPENAI] 🔄 Making API call to generate quiz questions with retry logic");
    let response;
    try {
      response = await withRateLimitRetry(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4", // Use the more capable model for quiz generation
          messages: [
            {
              role: "system",
              content: `You are an expert quiz creator that creates multiple-choice questions based on text content. 
              Create educational quiz questions that test understanding of key concepts and important details.
              Each question should have 4 answer choices with only one correct answer. 
              Questions should vary in difficulty and cover different aspects of the material.
              Distribute questions evenly across the entire content, not just focusing on the beginning or end.
              Focus especially on key terms and important sections highlighted.
              You MUST always respond with properly formatted JSON with a 'questions' array, NEVER plain text.
              If the content is insufficient, instead of explaining why in text, return valid JSON with an empty questions array like: {"questions":[]}`
            },
            {
              role: "user",
              content: `Create ${questionsCount} multiple-choice quiz questions based on the following content. 
              
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
              
              The "answer" must be the index (0-3) of the correct option in the options array.
              
              ${importantTerms.length > 0 ? `Key terms to emphasize: ${importantTerms.join(', ')}` : ''}
              
              ${importantSections.length > 0 ? 'Important sections to highlight:\n' + importantSections.join('\n\n') : ''}
              
              If the provided content isn't sufficient, return: {"questions":[]} as valid JSON.
              NEVER respond with text outside of the JSON format, no matter what.
              
              Here's the content to create questions about:
              
              ${processedContent}`
            }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }, {
          timeout: 120000, 
          signal: controller.signal
        });
      }, 5, 2000); // 5 retries, starting with 2-second delay
    } catch (apiError) {
      console.error(`[OPENAI] ❌ Fatal API error after retries: ${apiError.message}`, apiError);
      
      // Emit an error event that the UI can respond to
      const errorEvent = new CustomEvent('quiz-generation-error', {
        detail: { 
          message: "Quiz generation failed due to API issues",
          error: apiError.message 
        }
      });
      window.dispatchEvent(errorEvent);
      
      // Return a fallback empty questions array with error information
      return { 
        questions: [], 
        error: {
          message: "Failed to generate quiz questions due to API error",
          details: apiError.message,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    const endTime = performance.now();
    console.log(`[OPENAI] ⏱️ Quiz generation API call finished at: ${new Date().toISOString()}`);
    console.log(`[OPENAI] ⏱️ Quiz generation API call took ${(endTime - startTime).toFixed(2)}ms`);
    
    // Make sure we have a valid response
    if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
      console.error("[OPENAI] ❌ Received invalid or empty response from API");
      
      // Emit an error event
      const errorEvent = new CustomEvent('quiz-generation-error', {
        detail: { message: "Quiz generation failed due to invalid API response" }
      });
      window.dispatchEvent(errorEvent);
      
      return { 
        questions: [], 
        error: {
          message: "Received invalid response from OpenAI API",
          timestamp: new Date().toISOString()
        }
      };
    }
    
    const content = response.choices[0].message.content;
    console.log(`[OPENAI] ✅ Successfully generated quiz - Response raw content length: ${content.length}`);
    console.log(`[OPENAI] 📊 First 300 chars of raw response: "${content.substring(0, 300)}..."`);
    
    try {
      // Check if response is plain text instead of JSON
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        console.error(`[OPENAI] ❌ Empty or invalid content received from API`);
        return { 
          questions: [],
          error: {
            message: "Empty response received from API",
            timestamp: new Date().toISOString()
          }
        };
      }
      
      if (content.trim().startsWith("Sorry") || content.trim().startsWith("I") || !content.trim().startsWith("{")) {
        console.error(`[OPENAI] ❌ Received text response instead of JSON: ${content.substring(0, 200)}...`);
        
        // Try to recover by extracting JSON if possible
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log(`[OPENAI] 🔄 Attempting to extract JSON from text response`);
          const extractedJson = jsonMatch[0];
          try {
            const extractedData = JSON.parse(extractedJson);
            console.log(`[OPENAI] ✅ Successfully extracted JSON from text response`);
            
            if (extractedData.questions && Array.isArray(extractedData.questions)) {
              return extractedData;
            }
          } catch (extractError) {
            console.error(`[OPENAI] ❌ Failed to extract valid JSON: ${extractError.message}`);
          }
        }
        
        // Return empty questions array with the text content for debugging
        return { 
          questions: [],
          error: {
            message: "API returned text instead of JSON",
            content: content.substring(0, 500),
            timestamp: new Date().toISOString()
          }
        };
      }
      
      let quizData;
      try {
        quizData = JSON.parse(content);
      } catch (parseError) {
        console.error(`[OPENAI] ❌ JSON parse error: ${parseError.message}`);
        console.error(`[OPENAI] ❌ Invalid JSON content: ${content.substring(0, 500)}...`);
        
        // Try to clean the JSON string before parsing again
        const cleanedContent = content
          .replace(/^[^{]*/, '') // Remove anything before the first {
          .replace(/[^}]*$/, ''); // Remove anything after the last }
        
        try {
          console.log(`[OPENAI] 🔄 Attempting to parse cleaned JSON`);
          quizData = JSON.parse(cleanedContent);
          console.log(`[OPENAI] ✅ Successfully parsed cleaned JSON`);
        } catch (secondParseError) {
          // If that still fails, return an empty questions array
          console.error(`[OPENAI] ❌ Failed to parse cleaned JSON: ${secondParseError.message}`);
          return { 
            questions: [],
            error: {
              message: "Failed to parse question data",
              parseError: parseError.message,
              timestamp: new Date().toISOString()
            }
          };
        }
      }
      
      console.log(`[OPENAI] 📊 Generated ${quizData.questions ? quizData.questions.length : 0} questions`);
      
      // Check if we got an empty questions array
      if (!quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
        console.warn(`[OPENAI] ⚠️ No questions were generated. Returning empty questions array.`);
        return { 
          questions: [],
          warning: "No questions could be generated from the provided content"
        };
      }
      
      // Validate each question has the required properties
      const validatedQuestions = quizData.questions.filter(q => {
        const isValid = q && 
                      typeof q.question === 'string' && 
                      Array.isArray(q.options) && 
                      q.options.length === 4 &&
                      (typeof q.answer === 'number' || typeof q.answer === 'string') &&
                      typeof q.explanation === 'string';
                      
        if (!isValid) {
          console.warn(`[OPENAI] ⚠️ Filtered out invalid question: ${JSON.stringify(q)}`);
        }
        
        return isValid;
      });
      
      if (validatedQuestions.length < quizData.questions.length) {
        console.warn(`[OPENAI] ⚠️ Filtered out ${quizData.questions.length - validatedQuestions.length} invalid questions`);
      }
      
      // If we lost all questions during validation, return an error
      if (validatedQuestions.length === 0 && quizData.questions.length > 0) {
        console.error(`[OPENAI] ❌ All ${quizData.questions.length} questions were invalid`);
        return {
          questions: [],
          error: {
            message: "All generated questions were invalid",
            timestamp: new Date().toISOString()
          }
        };
      }
      
      console.log(`[OPENAI] 🏁 QUIZ GENERATION COMPLETE - JSON successfully parsed`);
      
      // Make sure the data structure matches what the app expects
      // The app expects { questions: [...] } format
      const formattedQuizData = { questions: validatedQuestions };
      
      console.log(`[OPENAI] 📊 Quiz data structure check - has questions property: ${Boolean(formattedQuizData.questions)}`);
      console.log(`[OPENAI] 📊 Quiz data final structure: ${JSON.stringify({
        type: typeof formattedQuizData,
        hasQuestions: Boolean(formattedQuizData.questions),
        questionsCount: formattedQuizData.questions ? formattedQuizData.questions.length : 0
      })}`);
      
      // Store the quiz template for future use
      if (pdfId && formattedQuizData.questions && formattedQuizData.questions.length > 0) {
        try {
          console.log(`[OPENAI] 💾 Storing quiz template for PDF ID: ${pdfId}`);
          
          const templateStoreStart = performance.now();
          // Pass the actual questions array directly to the storeQuizTemplate function
          await storeQuizTemplate(pdfId, validatedQuestions);
          const templateStoreEnd = performance.now();
          
          console.log(`[OPENAI] ⏱️ Quiz template storage took ${(templateStoreEnd - templateStoreStart).toFixed(2)}ms`);
          console.log(`[OPENAI] ✅ Successfully stored quiz template`);
          console.log(`[OPENAI] 🏁 TEMPLATE STORAGE COMPLETE - Quiz template saved to database`);
        } catch (storeError) {
          console.error(`[OPENAI] ❌ Error storing quiz template: ${storeError.message}`, storeError);
          // Continue despite storage error, but add a warning to the result
          formattedQuizData.warning = "Quiz generated successfully but could not be saved for future use";
        }
      }
      
      return formattedQuizData;
    } catch (parseError) {
      console.error("[OPENAI] ❌ Error parsing quiz JSON:", parseError);
      console.error("[OPENAI] ❌ Raw content that failed to parse:", content);
      
      // Emit an error event
      const errorEvent = new CustomEvent('quiz-generation-error', {
        detail: { 
          message: "Failed to parse quiz data",
          error: parseError.message
        }
      });
      window.dispatchEvent(errorEvent);
      
      // Return empty questions as a fallback with error information
      return { 
        questions: [],
        error: {
          message: "Failed to parse quiz data",
          details: parseError.message,
          timestamp: new Date().toISOString()
        }
      };
    }
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
