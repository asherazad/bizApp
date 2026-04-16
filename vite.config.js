import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // In dev: proxy /api to local Express server on 4000
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          react:    ['react', 'react-dom', 'react-router-dom'],
          charts:   ['recharts'],
          vendor:   ['axios', 'date-fns', 'clsx'],
        },
      },
    },
  },
  define: {
    // Make env available in frontend code
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
