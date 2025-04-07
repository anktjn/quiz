import { supabase } from './supabase';

export async function savePDFMetadata({ name, file_url, user_id }) {
    const { data, error } = await supabase.from("pdfs").insert([
      {
        name,
        file_url,
        user_id,
      },
    ]).select().single(); // 👈 this returns the inserted row
  
    if (error) {
      throw error;
    }
  
    return data; // 👈 return the full PDF record, including id
  }
  
  