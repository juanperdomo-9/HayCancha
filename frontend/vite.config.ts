import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
// La dirección pública de la página, para la vista previa al compartir (index.html).
// ETAPA 2: https://haycancha.com.ar (o la variable VITE_SITE_URL en Render).
process.env.VITE_SITE_URL ??= 'https://haycancha-web.onrender.com'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
