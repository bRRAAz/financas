import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const key = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (key && !/^sb_publishable_[\w-]+$/.test(key)) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY deve conter uma chave publicável do Supabase.')
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [{ name: 'supabase', test: /[\\/]node_modules[\\/]@supabase[\\/]/ }],
          },
        },
      },
    },
  }
})
