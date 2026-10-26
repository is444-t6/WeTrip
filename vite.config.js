import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Frontend calls /api/family/<Method>, Vite forwards it to
      // Family_Composite so the browser never hits OutSystems (and SMU's
      // CORS/AllowedOrigin setup) directly during local dev.
      '/api/family': {
        target: 'https://smuedu-dev.outsystemsenterprise.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/family/, '/WeTrip_Family_Composite/rest/Family'),
      },
    },
  },
})
