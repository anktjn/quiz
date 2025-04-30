import { extractTextFromPDF } from './pdf';
import { processPDFContent } from './openai';
import { generateQuizQuestions } from './openai';
import { supabase } from './supabase';

console.log('[BACKGROUND] Initializing background processing module');

/**
 * Queue for tracking PDFs that need background processing
 * @type {Array}
 */
const processingQueue = [];

/**
 * Flag to track if the background processor is already running
 * @type {boolean}
 */
let isProcessing = false;

/**
 * Add a PDF to the background processing queue
 * @param {string} pdfId - The ID of the PDF
 * @param {string} fileUrl - The URL of the PDF file
 * @returns {Promise<void>}
 */
export async function queuePDFForProcessing(pdfId, fileUrl) {
  console.log(`[BACKGROUND] 🔄 queuePDFForProcessing - Starting - PDF ID: ${pdfId}`);
  
  // Check if this PDF is already in the queue
  if (processingQueue.some(item => item.pdfId === pdfId)) {
    console.log(`[BACKGROUND] ⚠️ PDF ${pdfId} is already queued for processing`);
    return;
  }
  
  // Add to queue
  processingQueue.push({ pdfId, fileUrl });
  console.log(`[BACKGROUND] ✅ Added PDF ${pdfId} to processing queue, total items: ${processingQueue.length}`);
  console.log(`[BACKGROUND] 📊 Current queue:`, processingQueue.map(item => item.pdfId));
  
  // Start processing if not already running
  if (!isProcessing) {
    console.log(`[BACKGROUND] 🔄 Processing not currently running, starting processor`);
    processNextPDF();
  } else {
    console.log(`[BACKGROUND] ℹ️ Processing already running, new item will be processed when current job completes`);
  }
  
  console.log(`[BACKGROUND] ✅ queuePDFForProcessing - Finished`);
}

/**
 * Process the next PDF in the queue
 * @returns {Promise<void>}
 */
async function processNextPDF() {
  console.log(`[BACKGROUND] 🔄 processNextPDF - Starting - Queue size: ${processingQueue.length}`);
  
  if (processingQueue.length === 0) {
    isProcessing = false;
    console.log('[BACKGROUND] ℹ️ Processing queue is empty, stopping processor');
    return;
  }
  
  isProcessing = true;
  const { pdfId, fileUrl } = processingQueue.shift();
  console.log(`[BACKGROUND] 🔄 Processing PDF ${pdfId} from queue - Remaining items: ${processingQueue.length}`);
  
  try {
    console.log(`[BACKGROUND] 🔄 Processing PDF ${pdfId} in background`);
    
    // Update status
    console.log(`[BACKGROUND] 🔄 Updating status to 'processing' for PDF ${pdfId}`);
    await updateProcessingStatus(pdfId, 'processing');
    
    // Fetch the PDF
    console.log(`[BACKGROUND] 🔄 Fetching PDF from URL: ${fileUrl}`);
    const startFetchTime = performance.now();
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error(`[BACKGROUND] ❌ Failed to fetch PDF file: ${response.status} ${response.statusText}`);
      throw new Error('Failed to fetch PDF file');
    }
    
    const blob = await response.blob();
    const endFetchTime = performance.now();
    console.log(`[BACKGROUND] ✅ PDF fetched successfully - Size: ${(blob.size / 1024 / 1024).toFixed(2)}MB, Time: ${(endFetchTime - startFetchTime).toFixed(2)}ms`);
    
    const file = new File([blob], "background-processing.pdf", { type: "application/pdf" });
    
    // Extract text
    console.log(`[BACKGROUND] 🔄 Extracting text from PDF`);
    const startExtractTime = performance.now();
    const pdfText = await extractTextFromPDF(file);
    const endExtractTime = performance.now();
    
    if (!pdfText || pdfText.trim().length === 0) {
      console.error(`[BACKGROUND] ❌ Could not extract text from PDF`);
      throw new Error('Could not extract text from PDF');
    }
    
    console.log(`[BACKGROUND] ✅ Text extracted successfully - Length: ${pdfText.length}, Time: ${(endExtractTime - startExtractTime).toFixed(2)}ms`);
    
    // Process content and generate quiz
    console.log(`[BACKGROUND] 🔄 Starting PDF content processing`);
    const startProcessTime = performance.now();
    
    console.log(`[BACKGROUND] 🔄 Calling processPDFContent for PDF ${pdfId}`);
    await processPDFContent(pdfText, pdfId);
    console.log(`[BACKGROUND] ✅ processPDFContent completed for PDF ${pdfId}`);
    
    console.log(`[BACKGROUND] 🔄 Calling generateQuizQuestions for PDF ${pdfId}`);
    await generateQuizQuestions(pdfText, pdfId, true, 50); // Generate 50 questions for the template
    console.log(`[BACKGROUND] ✅ generateQuizQuestions completed for PDF ${pdfId}`);
    
    const endProcessTime = performance.now();
    console.log(`[BACKGROUND] ✅ PDF content and quiz processing completed - Total time: ${((endProcessTime - startProcessTime) / 1000).toFixed(2)}s`);
    
    // Update status to complete
    console.log(`[BACKGROUND] 🔄 Updating status to 'complete' for PDF ${pdfId}`);
    await updateProcessingStatus(pdfId, 'complete');
    
    console.log(`[BACKGROUND] ✅ Successfully processed PDF ${pdfId}`);
  } catch (error) {
    console.error(`[BACKGROUND] ❌ Error processing PDF ${pdfId}:`, error);
    console.error(`[BACKGROUND] ❌ Error details:`, {
      message: error.message,
      stack: error.stack
    });
    await updateProcessingStatus(pdfId, 'error', error.message);
  }
  
  // Process next PDF in queue
  console.log(`[BACKGROUND] 🔄 Moving to next PDF in queue (remaining: ${processingQueue.length})`);
  processNextPDF();
}

/**
 * Update the processing status of a PDF
 * @param {string} pdfId - The ID of the PDF
 * @param {string} status - The status (processing, complete, error)
 * @param {string} errorMessage - Optional error message
 * @returns {Promise<void>}
 */
async function updateProcessingStatus(pdfId, status, errorMessage = null) {
  console.log(`[BACKGROUND] 🔄 updateProcessingStatus - PDF ID: ${pdfId}, Status: ${status}`);
  
  try {
    const updates = {
      processing_status: status,
      processing_updated_at: new Date()
    };
    
    if (errorMessage) {
      updates.processing_error = errorMessage;
      console.log(`[BACKGROUND] ❌ Error message: ${errorMessage}`);
    }
    
    console.log(`[BACKGROUND] 🔄 Updating database record for PDF ${pdfId}`);
    const { error } = await supabase
      .from('pdfs')
      .update(updates)
      .eq('id', pdfId);
      
    if (error) {
      console.error(`[BACKGROUND] ❌ Supabase error updating status:`, error);
      throw error;
    }
    
    console.log(`[BACKGROUND] ✅ Status updated successfully for PDF ${pdfId}`);
  } catch (error) {
    console.error('[BACKGROUND] ❌ Error updating processing status:', error);
    console.error('[BACKGROUND] ❌ Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

/**
 * Check if a PDF is currently being processed
 * @param {string} pdfId - The ID of the PDF
 * @returns {Promise<Object>} Object with status and error if any
 */
export async function checkProcessingStatus(pdfId) {
  console.log(`[BACKGROUND] 🔄 checkProcessingStatus - PDF ID: ${pdfId}`);
  
  try {
    // Check if it's in the queue
    const queuePosition = processingQueue.findIndex(item => item.pdfId === pdfId);
    if (queuePosition >= 0) {
      console.log(`[BACKGROUND] 🔄 PDF ${pdfId} is in queue at position ${queuePosition + 1} of ${processingQueue.length}`);
      return { 
        status: 'queued', 
        position: queuePosition + 1,
        total: processingQueue.length
      };
    }
    
    // Check database status
    console.log(`[BACKGROUND] 🔄 Checking database status for PDF ${pdfId}`);
    const { data, error } = await supabase
      .from('pdfs')
      .select('processing_status, processing_error, processing_updated_at')
      .eq('id', pdfId)
      .single();
      
    if (error) {
      console.error(`[BACKGROUND] ❌ Supabase error checking status:`, error);
      throw error;
    }
    
    console.log(`[BACKGROUND] ✅ Found status for PDF ${pdfId}: ${data.processing_status}`);
    
    return {
      status: data.processing_status || 'unknown',
      error: data.processing_error,
      updatedAt: data.processing_updated_at
    };
  } catch (error) {
    console.error('[BACKGROUND] ❌ Error checking processing status:', error);
    return { status: 'unknown', error: error.message };
  }
} 