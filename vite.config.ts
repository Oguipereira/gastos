import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Lê só as duas variáveis públicas do Supabase (aceita nomes com ou sem VITE_)
// e injeta no build. Nenhuma outra variável de ambiente vai para o navegador.
const pick = (env: Record<string, string>, names: string[]) => names.map((n) => env[n]).find(Boolean) ?? ''

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const url = pick(env, ['VITE_SUPABASE_URL', 'SUPABASE_URL', 'supabase_url'])
  const key = pick(env, [
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'supabase_publishable_key',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
  ])
  return {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(url.trim()),
      __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(key.trim()),
    },
  }
})
