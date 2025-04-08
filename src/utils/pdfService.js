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
  
