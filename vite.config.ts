import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'react-vendor';
          }

          if (id.includes('recharts') || id.includes('victory') || id.includes('d3-')) {
            return 'chart-vendor';
          }

          if (id.includes('pdfjs-dist') || id.includes('@react-pdf-viewer')) {
            return 'pdf-vendor';
          }

          if (id.includes('katex') || id.includes('html-react-parser')) {
            return 'content-vendor';
          }

          if (id.includes('react-router-dom') || id.includes('styled-components')) {
            return 'routing-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
});
