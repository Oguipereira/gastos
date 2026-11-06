import { createClient } from '@supabase/supabase-js'

// Injetadas no build pelo vite.config.ts a partir das variáveis de ambiente.
declare const __SUPABASE_URL__: string
declare const __SUPABASE_PUBLISHABLE_KEY__: string

const url = __SUPABASE_URL__
const key = __SUPABASE_PUBLISHABLE_KEY__

if (!url || !key) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (veja .env.example).')
}

// Só a chave publicável vai para o navegador; o acesso aos dados é protegido por RLS no banco.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})
