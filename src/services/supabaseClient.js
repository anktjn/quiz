import { createClient } from '@supabase/supabase-js';

// Ensure the URL ends with a trailing slash
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.endsWith('/') 
  ? import.meta.env.VITE_SUPABASE_URL 
  : `${import.meta.env.VITE_SUPABASE_URL}/`;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 