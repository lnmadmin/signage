import { createRequire } from 'module';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        require('./node_modules/tailwindcss/lib/index.js')({ content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'] }),
        require('autoprefixer'),
      ],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
