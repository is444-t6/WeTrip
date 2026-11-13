import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config.js'

// `bun run dev:https`: same dev server over HTTPS and on the LAN, so a phone can
// open the camera for Scan to Pay. Browsers only allow the camera on HTTPS or
// localhost. The certificate is self-signed, so the phone shows a warning once.
export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [basicSsl()],
    server: { host: true },
  }),
)
