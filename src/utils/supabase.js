import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON

if (!url || !key) {
  throw new Error('Missing Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON). Check your Vercel environment variable settings.')
}

export const supabase = createClient(url, key)
