import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/proxy': {
        target: 'https://api.tavernsealedleague.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy/, '') // Remove the '/proxy' prefix
      },
    },
  },
});
