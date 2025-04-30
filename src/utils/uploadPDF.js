import { supabase } from './supabase';

export async function uploadPDF(file, filePath) {
  try {
    console.log(`[uploadPDF] Uploading file: ${file.name}, path: ${filePath}`);
    
    // Upload the file
    const { data, error } = await supabase
      .storage
      .from('pdfs')
      .upload(filePath, file);

    if (error) {
      console.error('[uploadPDF] Upload error:', error);
      throw error;
    }

    // Get the public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('pdfs')
      .getPublicUrl(filePath);

    console.log('[uploadPDF] Upload successful, public URL:', publicUrlData?.publicUrl);

    return {
      data: {
        path: filePath,
        publicUrl: publicUrlData?.publicUrl
      }
    };
  } catch (error) {
    console.error('[uploadPDF] Error in uploadPDF:', error);
    throw error;
  }
}
