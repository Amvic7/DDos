import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      '/graph-data': 'http://localhost:5000',
      '/api/'": 'https://ddos-project.onrender.com'
    },
  }
})
