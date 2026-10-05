import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // force IPv4 loopback -- `localhost` can resolve IPv6-only ([::1]) on
    // some networks (observed with a VPN active), leaving the dev server unreachable even though
    // it's genuinely running. Binding IPv4 explicitly keeps `http://localhost:4321` working
    // since the browser still sends that Origin/Host regardless of which address it resolves to.
    port: 4321,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8420',
        changeOrigin: true,
      },
    },
  },
})
