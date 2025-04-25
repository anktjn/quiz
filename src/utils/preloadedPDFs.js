import { supabase } from './supabase';
import { fetchBookCover } from './bookCovers';

/**
 * Uploads a PDF file to Supabase Storage and adds it to the preloaded_pdfs table
 * @param {File} file - The PDF file object
 * @param {Object} metadata - Metadata about the PDF
 * @param {string} metadata.title - The title of the PDF
 * @param {string} metadata.author - The author of the PDF
 * @param {string} metadata.description - A description of the PDF (optional)
 * @param {File} [coverFile] - Optional cover image file
 * @returns {Promise<Object>} The created preloaded PDF record
 */
export async function uploadPreloadedPDF(file, metadata, coverFile = null) {
  try {
    // Upload the file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `preloaded_${Date.now()}.${fileExt}`;
    const filePath = `preloaded/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(filePath);

    // Handle cover image (either upload provided cover or fetch one)
    let coverUrl = null;
    
    if (coverFile) {
      // If a cover file was provided, upload it
      const coverExt = coverFile.name.split('.').pop();
      const coverName = `cover_${Date.now()}.${coverExt}`;
      const coverPath = `covers/${coverName}`;
      
      const { error: coverUploadError } = await supabase.storage
        .from('pdfs')
        .upload(coverPath, coverFile);
      
      if (coverUploadError) {
        console.warn('Error uploading cover, will try to fetch one instead:', coverUploadError);
      } else {
        // Get the public URL for the uploaded cover
        const { data: { publicUrl: coverPublicUrl } } = supabase.storage
          .from('pdfs')
          .getPublicUrl(coverPath);
        
        coverUrl = coverPublicUrl;
      }
    }
    
    // If no cover was provided or upload failed, try to fetch one
    if (!coverUrl) {
      try {
        coverUrl = await fetchBookCover(`${metadata.title} by ${metadata.author}`);
      } catch (coverError) {
        console.error('Error fetching cover:', coverError);
        // If error, leave coverUrl as null
      }
    }

    // Add the PDF to the preloaded_pdfs table
    const { data, error } = await supabase
      .from('preloaded_pdfs')
      .insert([
        {
          title: metadata.title,
          author: metadata.author,
          description: metadata.description || null,
          file_url: publicUrl,
          cover_url: coverUrl
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error uploading preloaded PDF:', error);
    throw error;
  }
}

/**
 * Uploads multiple PDF files to Supabase Storage and adds them to the preloaded_pdfs table
 * @param {Array<Object>} pdfFiles - Array of PDF files with metadata
 * @param {File} pdfFiles[].file - The PDF file object
 * @param {Object} pdfFiles[].metadata - Metadata about the PDF
 * @param {string} pdfFiles[].metadata.title - The title of the PDF
 * @param {string} pdfFiles[].metadata.author - The author of the PDF
 * @param {string} pdfFiles[].metadata.description - A description of the PDF (optional)
 * @param {File} [pdfFiles[].coverFile] - Optional cover image file for this PDF
 * @param {Function} onProgress - Optional callback function that receives progress updates (percent completed, current file index)
 * @returns {Promise<Array<Object>>} Array of created preloaded PDF records
 */
export async function bulkUploadPreloadedPDFs(pdfFiles, onProgress) {
  const results = [];
  const errors = [];
  let completed = 0;

  // Process files in batches to avoid overwhelming the server
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
    const batch = pdfFiles.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchPromises = batch.map(async ({ file, metadata, coverFile }, batchIndex) => {
      const index = i + batchIndex;
      try {
        const result = await uploadPreloadedPDF(file, metadata, coverFile);
        results.push(result);
        return { success: true, index };
      } catch (error) {
        errors.push({ file, metadata, error });
        return { success: false, index, error };
      }
    });

    // Wait for all uploads in this batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Update completion status
    completed += batchResults.length;
    if (onProgress) {
      onProgress({
        percent: Math.round((completed / pdfFiles.length) * 100),
        completed,
        total: pdfFiles.length,
        errors: errors.length
      });
    }
  }

  if (errors.length > 0) {
    console.error(`Completed with ${errors.length} errors:`, errors);
  }

  return {
    successful: results,
    failed: errors,
    totalCount: pdfFiles.length,
    successCount: results.length,
    errorCount: errors.length
  };
}

/**
 * Get all preloaded PDFs
 * @returns {Promise<Array>} Array of preloaded PDFs
 */
export async function getPreloadedPDFs() {
  try {
    const { data, error } = await supabase
      .from('preloaded_pdfs')
      .select('*')
      .order('title');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching preloaded PDFs:', error);
    throw error;
  }
}

/**
 * Search preloaded PDFs
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of matching preloaded PDFs
 */
export async function searchPreloadedPDFs(query) {
  try {
    if (!query || query.trim() === '') {
      return getPreloadedPDFs();
    }

    const { data, error } = await supabase
      .from('preloaded_pdfs')
      .select('*')
      .or(`title.ilike.%${query}%,author.ilike.%${query}%,description.ilike.%${query}%`)
      .order('title');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching preloaded PDFs:', error);
    throw error;
  }
}

/**
 * Add a preloaded PDF to a user's library
 * @param {Object} user - The user object
 * @param {string} preloadedPdfId - The ID of the preloaded PDF
 * @returns {Promise<Object>} The created PDF record
 */
export async function addPreloadedPDFToLibrary(user, preloadedPdfId) {
  try {
    // Get the preloaded PDF
    const { data: preloadedPdf, error: fetchError } = await supabase
      .from('preloaded_pdfs')
      .select('*')
      .eq('id', preloadedPdfId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!preloadedPdf) throw new Error('Preloaded PDF not found');
    
    // Check if user already has this PDF
    const { data: existingPDFs } = await supabase
      .from('pdfs')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_pdf_id', preloadedPdfId);
    
    if (existingPDFs?.length > 0) {
      throw new Error(`${preloadedPdf.title} is already in your library`);
    }
    
    // Add to the user's library
    const { data, error } = await supabase
      .from('pdfs')
      .insert([
        {
          name: `${preloadedPdf.title} by ${preloadedPdf.author}.pdf`,
          file_url: preloadedPdf.file_url,
          cover_url: preloadedPdf.cover_url,
          user_id: user.id,
          source_pdf_id: preloadedPdf.id,
          is_preloaded: true
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding preloaded PDF to library:', error);
    throw error;
  }
} 