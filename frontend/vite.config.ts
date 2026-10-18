import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'mui',
              test: /[\\/]node_modules[\\/]@mui/,
            },
            {
              name: 'vendor',
              test: /node_modules/,
            },
          ],
        },
      },
    },
  },

  plugins: [react()],
  server: {
    proxy: {
      '/proxy': {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy/, ''), // Remove the '/proxy' prefix
        target: 'https://api.tslsite.com',
      },
    },
  },
});
