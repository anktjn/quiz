import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
export async function savePDFMetadata({ name, file_url }) {
    const { data, error } = await supabase
      .from('pdfs')
      .insert([
        { name, upload_at: new Date(), file_url }
      ]);
  
    if (error) {
      console.error('Error saving PDF metadata:', error);
      throw error;
    }
  
    return data;
  }
  