import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// The canonical public origin. Set VITE_SITE_URL in the host (Vercel) to your
// real domain; this default is the fallback for local builds.
const SITE_URL = (process.env.VITE_SITE_URL || 'https://filequik.in').replace(/\/+$/, '')

// Replaces __SITE_URL__ in index.html (canonical, og:url, JSON-LD) at build time.
const siteUrlHtml = {
  name: 'inject-site-url',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlHtml],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: false,
    // Enables WASM multi-threading (crossOriginIsolated) so background removal /
    // heavy image work runs several times faster. Mirror these on the prod host.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    include: [
      'pdfjs-dist',
      'fabric-pure-browser',
      'pdf-lib',
      'docx-preview',
      'html2canvas'
    ],
    // tesseract.js is loaded as a static script from /public/tesseract, not bundled.
    exclude: ['@imgly/background-removal']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    }
  },
  resolve: {
    alias: {
      'pdfjs-dist': resolve(__dirname, 'node_modules/pdfjs-dist'),
      'pdfjs-dist/build/pdf.worker.min.js': resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js')
    }
  }
})
