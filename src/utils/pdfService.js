import { supabase } from './supabase';

export async function savePDFMetadata({ name, file_url, user_id }) {
    const { data, error } = await supabase
      .from("pdfs")
      .insert([{ name, file_url, user_id }])
      .select()
      .single();
  
    if (error) throw error;
    return data; // ✅ this should contain { id, name, file_url, ... }
}

/**
 * Store extracted text from a PDF
 * @param {string} pdf_id - The ID of the PDF
 * @param {string} extractedText - The full text extracted from the PDF
 * @param {Array} chunks - Optional array of text chunks with summaries
 * @param {boolean} isInterim - Whether this is an interim save during processing
 * @returns {Promise<Object>} The stored PDF content record
 */
export async function storePDFContent(pdf_id, extractedText, chunks = null, isInterim = false) {
  if (!pdf_id) {
    console.error(`[PDF Service] ❌ Invalid PDF ID for storePDFContent: ${pdf_id}`);
    return { success: false, error: "Invalid PDF ID" };
  }
  
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    console.error(`[PDF Service] ❌ Invalid chunks for storePDFContent: ${typeof chunks}, length: ${chunks?.length || 0}`);
    return { success: false, error: "Invalid or empty chunks array" };
  }
  
  console.log(`[PDF Service] 🔄 Storing PDF content for PDF ID: ${pdf_id} with ${chunks.length} chunks`);
  
  try {
    // Validate and clean chunks data to prevent circular references and large objects
    const validatedChunks = chunks.map((chunk, index) => {
      // Ensure chunk has required properties
      if (!chunk || typeof chunk !== 'object') {
        console.warn(`[PDF Service] ⚠️ Chunk at index ${index} is not a valid object, creating placeholder`);
        return {
          index: index,
          text: "",
          pageNumber: 0,
          metadata: { pageNumber: 0 }
        };
      }
      
      // Clean any error messages from text
      let cleanedText = "";
      if (typeof chunk.text === 'string') {
        // Remove any error messages (common pattern in logs)
        cleanedText = chunk.text
          .replace(/Error:.*$/gm, '')
          .replace(/\[ERROR\].*$/gm, '')
          .substring(0, 10000); // Limit each chunk to 10KB
      } else if (chunk.text) {
        // Convert non-string text to string
        cleanedText = String(chunk.text).substring(0, 10000);
      }
      
      // Create a simplified version of each chunk to ensure it's serializable
      return {
        index: index,
        text: cleanedText,
        pageNumber: typeof chunk.pageNumber === 'number' ? chunk.pageNumber : 0,
        metadata: {
          pageNumber: typeof chunk.pageNumber === 'number' ? chunk.pageNumber : 0,
          importance: typeof chunk.metadata?.importance === 'number' ? chunk.metadata.importance : 0,
          keyTerms: Array.isArray(chunk.metadata?.keyTerms) ? 
            chunk.metadata.keyTerms.slice(0, 20).map(term => typeof term === 'string' ? term : String(term)) : []
        }
      };
    });
    
    // Check if total chunks data is too large
    const totalTextLength = validatedChunks.reduce((sum, chunk) => sum + (chunk.text?.length || 0), 0);
    if (totalTextLength > 5 * 1024 * 1024) { // 5MB text limit
      console.warn(`[PDF Service] ⚠️ Total text content is very large (${(totalTextLength / (1024 * 1024)).toFixed(2)}MB), truncating chunks`);
      
      // Reduce number of chunks if necessary
      let reducedChunks = [...validatedChunks];
      if (reducedChunks.length > 100) {
        reducedChunks = reducedChunks.slice(0, 100);
        console.warn(`[PDF Service] ⚠️ Reduced from ${validatedChunks.length} to ${reducedChunks.length} chunks due to size constraints`);
      }
      
      // Further limit text size in each chunk
      reducedChunks = reducedChunks.map(chunk => ({
        ...chunk,
        text: chunk.text.substring(0, 5000), // Limit each chunk to 5KB
      }));
      
      validatedChunks.length = 0; // Clear array
      validatedChunks.push(...reducedChunks); // Replace with reduced chunks
    }
    
    console.log(`[PDF Service] 📊 Prepared ${validatedChunks.length} validated chunks for storage`);
    
    // First check if content already exists for this PDF
    console.log(`[PDF Service] 🔍 Checking if content exists for PDF ID: ${pdf_id}`);
    const { data: existingContent, error: fetchError } = await supabase
      .from('pdf_contents')
      .select('id')
      .eq('pdf_id', pdf_id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid 406 error
    
    if (fetchError && !fetchError.message.includes('No rows found')) {
      console.error(`[PDF Service] ❌ Error checking for existing content: ${fetchError.message}`);
      return { success: false, error: fetchError.message };
    }
    
    let result;
    
    // Make sure chunks size is reasonable before sending to Supabase
    try {
      // Test serialization without actually storing the serialized string
      const testJson = JSON.stringify(validatedChunks);
      const jsonSize = testJson.length;
      console.log(`[PDF Service] 📊 JSON size for chunks: ${(jsonSize / 1024).toFixed(2)}KB`);
      
      if (jsonSize > 8 * 1024 * 1024) { // 8MB limit to be safe
        console.warn(`[PDF Service] ⚠️ Chunks data exceeds 8MB limit (${(jsonSize / (1024 * 1024)).toFixed(2)}MB), applying aggressive reduction`);
        
        // Aggressively reduce data size
        const severelyReducedChunks = validatedChunks
          .slice(0, 50) // Take only first 50 chunks
          .map(chunk => ({
            index: chunk.index,
            text: chunk.text.substring(0, 2000), // Limit text even more
            pageNumber: chunk.pageNumber,
            metadata: {
              pageNumber: chunk.pageNumber,
              // Remove non-essential metadata
              importance: chunk.metadata.importance
            }
          }));
          
        // Re-test the severely reduced chunks
        const reducedJson = JSON.stringify(severelyReducedChunks);
        const reducedSize = reducedJson.length;
        console.log(`[PDF Service] 📊 Reduced JSON size: ${(reducedSize / 1024).toFixed(2)}KB`);
        
        if (reducedSize > 8 * 1024 * 1024) {
          throw new Error(`Chunks data still too large after aggressive reduction: ${(reducedSize / (1024 * 1024)).toFixed(2)}MB`);
        }
        
        validatedChunks.length = 0;
        validatedChunks.push(...severelyReducedChunks);
      }
    } catch (jsonError) {
      console.error(`[PDF Service] ❌ Error with chunks JSON: ${jsonError.message}`);
      return { success: false, error: `Failed to process chunks: ${jsonError.message}` };
    }
    
    if (existingContent) {
      console.log(`[PDF Service] 🔄 Updating existing content for PDF ID: ${pdf_id}`);
      // Update existing record
      const { data, error: updateError } = await supabase
        .from('pdf_contents')
        .update({ 
          chunks: validatedChunks, // Supabase will handle the JSON serialization
          extracted_text: extractedText.substring(0, 1000000), // Limit text size to be safe
          last_accessed_at: new Date().toISOString()
        })
        .eq('pdf_id', pdf_id)
        .select('id');
        
      if (updateError) {
        console.error(`[PDF Service] ❌ Error updating content: ${updateError.message}`);
        return { success: false, error: updateError.message };
      }
      
      result = { success: true, id: data?.[0]?.id, updated: true };
    } else {
      console.log(`[PDF Service] 🔄 Inserting new content for PDF ID: ${pdf_id}`);
      // Insert new record
      const { data, error: insertError } = await supabase
        .from('pdf_contents')
        .insert({ 
          pdf_id: pdf_id,
          chunks: validatedChunks, // Supabase will handle the JSON serialization
          extracted_text: extractedText.substring(0, 1000000), // Limit text size to be safe
          processed_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString()
        })
        .select('id');
        
      if (insertError) {
        console.error(`[PDF Service] ❌ Error inserting content: ${insertError.message}`);
        return { success: false, error: insertError.message };
      }
      
      result = { success: true, id: data?.[0]?.id, inserted: true };
    }
    
    console.log(`[PDF Service] ✅ Successfully stored PDF content`);
    return result;
  } catch (error) {
    console.error(`[PDF Service] ❌ Error storing PDF content: ${error.message}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get PDF content for a specific PDF
 * @param {string} pdf_id - The ID of the PDF
 * @returns {Promise<Object|null>} The PDF content or null if not found
 */
export async function getPDFContent(pdf_id) {
  try {
    const { data, error } = await supabase
      .from("pdf_contents")
      .select("*")
      .eq("pdf_id", pdf_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Record not found
        return null;
      }
      throw error;
    }

    // Update last accessed time
    await supabase
      .from("pdf_contents")
      .update({ last_accessed_at: new Date() })
      .eq("pdf_id", pdf_id);

    return data;
  } catch (error) {
    console.error("Error retrieving PDF content:", error);
    throw error;
  }
}

/**
 * Check if PDF content exists for a specific PDF
 * @param {string} pdf_id - The ID of the PDF
 * @returns {Promise<boolean>} True if content exists, false otherwise
 */
export async function doesPDFContentExist(pdf_id) {
  try {
    const { data, error } = await supabase
      .from("pdf_contents")
      .select("id")
      .eq("pdf_id", pdf_id)
      .single();

    if (error && error.code === 'PGRST116') { // Record not found
      return false;
    }
    
    if (error) throw error;
    
    return Boolean(data);
  } catch (error) {
    console.error("Error checking PDF content:", error);
    return false;
  }
}

/**
 * Test function to verify PDF content storage is working
 * This can be called directly from the app for troubleshooting
 * @param {string} pdf_id - The ID of the PDF to test
 * @returns {Promise<Object>} The test result
 */
export async function testPDFContentStorage(pdf_id) {
  try {
    console.log(`Running test storage for PDF ID: ${pdf_id}`);
    
    // First check if content already exists
    const { data: existingContent, error: checkError } = await supabase
      .from('pdf_contents')
      .select('id')
      .eq('pdf_id', pdf_id)
      .maybeSingle();
      
    if (checkError) {
      console.error(`Error checking for existing content: ${checkError.message}`);
      throw checkError;
    }
    
    // Create test content
    const testChunks = [
      {
        index: 0,
        text: "This is a test chunk for PDF content storage.",
        pageNumber: 1,
        metadata: {
          pageNumber: 1,
          importance: 5,
          keyTerms: ["test", "storage"]
        }
      }
    ];
    
    // Insert or update test data
    let result;
    if (existingContent) {
      console.log(`Updating existing test content for PDF ID: ${pdf_id}`);
      const { data, error: updateError } = await supabase
        .from('pdf_contents')
        .update({
          chunks: testChunks,
          extracted_text: "Test content for PDF storage verification.",
          last_accessed_at: new Date().toISOString()
        })
        .eq('pdf_id', pdf_id)
        .select('id');
        
      if (updateError) {
        console.error(`Error updating test content: ${updateError.message}`);
        throw updateError;
      }
      
      result = { success: true, contentId: data?.[0]?.id, updated: true };
    } else {
      console.log(`Creating new test content for PDF ID: ${pdf_id}`);
      const { data, error: insertError } = await supabase
        .from('pdf_contents')
        .insert({
          pdf_id: pdf_id,
          chunks: testChunks,
          extracted_text: "Test content for PDF storage verification.",
          processed_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString()
        })
        .select('id');
        
      if (insertError) {
        console.error(`Error inserting test content: ${insertError.message}`);
        throw insertError;
      }
      
      result = { success: true, contentId: data?.[0]?.id, inserted: true };
    }
    
    // Verify we can retrieve the data
    const { data: verifyData, error: verifyError } = await supabase
      .from('pdf_contents')
      .select('id, processed_at, last_accessed_at')
      .eq('pdf_id', pdf_id)
      .maybeSingle();
      
    if (verifyError) {
      console.error(`Error verifying test content: ${verifyError.message}`);
      throw verifyError;
    }
    
    // Add verification details to result
    result.verificationDetails = {
      id: verifyData.id,
      processed_at: verifyData.processed_at,
      last_accessed_at: verifyData.last_accessed_at
    };
    
    console.log(`Test storage successful for PDF ID: ${pdf_id}`);
    return result;
  } catch (error) {
    console.error(`Test storage failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify that PDF content was successfully stored
 * @param {string} pdf_id - The ID of the PDF
 * @returns {Promise<Object>} Details about the stored content
 */
export async function verifyPDFContentStorage(pdf_id) {
  try {
    console.log(`🔍 Verifying PDF content storage for PDF ID: ${pdf_id}`);
    
    if (!pdf_id) {
      console.error("❌ No PDF ID provided to verifyPDFContentStorage");
      return { success: false, error: "PDF ID is required", details: null };
    }
    
    // Query the database to check if content exists and get basic info
    const { data, error } = await supabase
      .from("pdf_contents")
      .select("id, processed_at, last_accessed_at")
      .eq("pdf_id", pdf_id)
      .maybeSingle();
      
    if (error) {
      console.error("❌ Error verifying PDF content:", error);
      return { success: false, error: error.message, details: null };
    }
    
    if (!data) {
      console.log(`❌ No content found for PDF ID: ${pdf_id}`);
      return { 
        success: false, 
        error: "No content found in database", 
        details: { pdf_id }
      };
    }
    
    // Check content length
    const { data: contentSample, error: sampleError } = await supabase
      .from("pdf_contents")
      .select("extracted_text, chunks")
      .eq("pdf_id", pdf_id)
      .maybeSingle();
      
    if (sampleError) {
      console.error("❌ Error fetching content sample:", sampleError);
      return { 
        success: true, // Still consider verification successful as we confirmed the record exists
        details: {
          record_id: data.id,
          processed_at: data.processed_at,
          last_accessed_at: data.last_accessed_at,
          error_fetching_content: sampleError.message
        }
      };
    }
    
    const contentLength = contentSample?.extracted_text?.length || 0;
    const chunksCount = Array.isArray(contentSample?.chunks) ? contentSample.chunks.length : 0;
    
    console.log(`✅ Verified PDF content exists for PDF ID: ${pdf_id}`);
    console.log(`📊 Content record ID: ${data.id}`);
    console.log(`📊 Processed at: ${data.processed_at}`);
    console.log(`📊 Last accessed: ${data.last_accessed_at || 'Never'}`);
    console.log(`📊 Content length: ${contentLength} characters`);
    console.log(`📊 Chunks count: ${chunksCount}`);
    
    return {
      success: true,
      details: {
        record_id: data.id,
        processed_at: data.processed_at,
        last_accessed_at: data.last_accessed_at,
        content_length: contentLength,
        chunks_count: chunksCount
      }
    };
  } catch (error) {
    console.error("❌ Error in verifyPDFContentStorage:", error);
    return { success: false, error: error.message, details: { pdf_id } };
  }
}

/**
 * Clean up test or insufficient content for a PDF
 * This will remove any test content or insufficient data and
 * allow a fresh generation to happen
 * @param {string} pdf_id - The ID of the PDF
 * @returns {Promise<Object>} Result of the cleanup operation
 */
export async function cleanPDFContent(pdf_id) {
  try {
    console.log(`[PDF Service] 🧹 Cleaning PDF content for PDF ID: ${pdf_id}`);
    
    if (!pdf_id) {
      console.error(`[PDF Service] ❌ Invalid PDF ID for cleanPDFContent: ${pdf_id}`);
      return { success: false, error: "Invalid PDF ID" };
    }
    
    // First check if content exists
    const { data: existingContent, error: fetchError } = await supabase
      .from('pdf_contents')
      .select('id, extracted_text')
      .eq('pdf_id', pdf_id)
      .maybeSingle();
      
    if (fetchError && !fetchError.message.includes('No rows found')) {
      console.error(`[PDF Service] ❌ Error checking for existing content: ${fetchError.message}`);
      return { success: false, error: fetchError.message };
    }
    
    if (!existingContent) {
      console.log(`[PDF Service] ℹ️ No content to clean for PDF ID: ${pdf_id}`);
      return { success: true, cleaned: false, message: "No content exists" };
    }
    
    // Check if it's test data or very short content
    const isTestOrInsufficient = 
      existingContent.extracted_text.includes("Test content for PDF storage verification") ||
      existingContent.extracted_text.length < 500;
      
    if (!isTestOrInsufficient) {
      console.log(`[PDF Service] ✅ Content appears valid, no cleanup needed`);
      return { 
        success: true, 
        cleaned: false, 
        contentId: existingContent.id,
        message: "Content appears valid" 
      };
    }
    
    // Delete the content to allow fresh processing
    const { error: deleteError } = await supabase
      .from('pdf_contents')
      .delete()
      .eq('pdf_id', pdf_id);
      
    if (deleteError) {
      console.error(`[PDF Service] ❌ Error deleting test content: ${deleteError.message}`);
      return { success: false, error: deleteError.message };
    }
    
    console.log(`[PDF Service] ✅ Successfully cleaned PDF content for ID: ${pdf_id}`);
    return { 
      success: true, 
      cleaned: true, 
      contentId: existingContent.id,
      message: "Test/insufficient content removed" 
    };
    
  } catch (error) {
    console.error(`[PDF Service] ❌ Error cleaning PDF content: ${error.message}`, error);
    return { success: false, error: error.message };
  }
}
  
