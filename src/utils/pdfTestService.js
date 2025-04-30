import { supabase } from './supabase';
import { storePDFContent, getPDFContent } from './pdfService';

/**
 * Test function to verify PDF content storage is working
 * This can be called directly from the app for troubleshooting
 * @param {string} pdf_id - The ID of the PDF to test
 * @returns {Promise<Object>} The test result
 */
export async function testPDFContentStorage(pdf_id) {
  try {
    console.log(`Running test storage for PDF ID: ${pdf_id}`);
    
    // Generate a test content string
    const testContent = `Test content for ${pdf_id} created at ${new Date().toISOString()}. 
    This is a test to verify the storage functionality is working correctly.
    Dracula is a Gothic horror novel by Irish author Bram Stoker, published in 1897.`;
    
    // Generate a test chunks array with both valid and invalid chunks
    const testChunks = [
      {
        summaryLength: 100,
        originalLength: 200,
        summary: "This is test summary 1"
      },
      {
        summaryLength: 150,
        originalLength: 300,
        summary: "This is test summary 2"
      },
      // Add some invalid chunks to test validation
      null,
      {},
      { summaryLength: 100, originalLength: 200 }, // Missing summary
      { summary: "" }, // Empty summary
      { summary: "Error: Failed to process chunk. TypeError: Cannot read property of undefined" }, // Error in summary
      { summary: "abortOnUnload is not defined at line 42" } // Another error type
    ];
    
    console.log(`Created test data with ${testChunks.length} chunks (some intentionally invalid)`);
    
    // Try to store the content
    const result = await storePDFContent(pdf_id, testContent, testChunks);
    console.log(`Test storage successful. Content ID: ${result.id}`);
    
    // Verify we can retrieve it
    const retrieved = await getPDFContent(pdf_id);
    console.log(`Test retrieval successful? ${Boolean(retrieved)}`);
    
    // Check if validation worked by examining the stored chunks
    let validationWorked = false;
    if (retrieved && retrieved.chunks) {
      try {
        const storedChunks = JSON.parse(retrieved.chunks);
        validationWorked = storedChunks.length === 2; // Only the 2 valid chunks should remain
        console.log(`Validation test result: ${validationWorked ? 'PASSED' : 'FAILED'}`);
        console.log(`${storedChunks.length} chunks were stored after validation`);
      } catch (e) {
        console.error("Error parsing retrieved chunks:", e);
      }
    }
    
    return {
      success: true,
      contentId: result.id,
      retrievalSuccess: Boolean(retrieved),
      validationWorked,
      content: testContent.substring(0, 50) + "...",
      storedChunks: retrieved?.chunks ? JSON.parse(retrieved.chunks).length : 0
    };
  } catch (error) {
    console.error(`Test storage failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
} 