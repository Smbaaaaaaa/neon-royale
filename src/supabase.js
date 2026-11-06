import { createClient } from '@supabase/supabase-js'
// URL und Publishable Key sind öffentlich gedacht. Der Schutz kommt von den Zugriffsregeln in der Datenbank.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://edrevjoeeunkdvbxjskj.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_pVxhyspPWesDp6VLIqIDtw_w3CSbqqk'
export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
