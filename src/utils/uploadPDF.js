import { supabase } from './supabase';

export async function uploadPDF(file) {
  const fileName = `${Date.now()}_${file.name}`;

  const { data, error } = await supabase
    .storage
    .from('pdfs')
    .upload(fileName, file);

  if (error) {
    console.error('Upload error:', error);
    throw error;
  }

  const fileUrl = `${supabase.storageUrl}/object/public/pdfs/${fileName}`;

  return fileUrl;
}
