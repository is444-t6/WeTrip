import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import { ORIGIN, upstream } from './api/_services.js'

// Same-origin API paths, forwarded to the composites the way production does it
// (api/proxy.js): the dev server adds each composite's key from .env.local, so the
// browser never holds one and never calls OutSystems directly.
const env = loadEnv(
  process.env.NODE_ENV === 'production' ? 'production' : 'development',
  process.cwd(),
  '',
)

function proxyTo(service, prefix) {
  return {
    target: ORIGIN,
    changeOrigin: true,
    rewrite: (path) => {
      const u = new URL(path, 'http://localhost')
      const rest = u.pathname.slice(prefix.length)
      return upstream(service, rest, u.searchParams, env).url.slice(ORIGIN.length)
    },
    headers: upstream(service, '', '', env).headers,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    proxy: {
      '/api/family': proxyTo('family', '/api/family'),
      '/api/fx': proxyTo('fx', '/api/fx'),
      '/api/budget': proxyTo('budget', '/api/budget'),
      '/api/trip': proxyTo('trip', '/api/trip'),
      '/api/insurance': proxyTo('insurance', '/api/insurance'),
      '/scantopay': proxyTo('scantopay', '/scantopay'),
    },
  },
})
