import { createClient } from '@supabase/supabase-js';

// Gunakan environment variable jika ada, atau gunakan nilai default (agar tidak error saat di-hosting tanpa .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pyewzpzugazpdnorsrpp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZXd6cHp1Z2F6cGRub3JzcnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODcwMjMsImV4cCI6MjA5NTU2MzAyM30.6iX_1sZSsZ_2MltOz7uMdiHgtbZ-ocYuFWuf3u0pBOg';

if (!supabaseUrl || !supabaseAnonKey) {
 console.error(
 '[Supabase] Missing environment variables.\n' +
 'Please copy .env.example to .env and fill in your Supabase credentials.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
