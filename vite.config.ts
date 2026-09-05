import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy Wishabi/Flipp so the browser avoids CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/flipp/search': {
        target: 'https://backflipp.wishabi.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/flipp\/search/, '/flipp/items/search'),
      },
      '/api/flipp/flyer': {
        target: 'https://backflipp.wishabi.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/flipp\/flyer/, '/flipp/flyers'),
      },
      // Optional FlyerKit (needs access_token) — kept for experiments
      '/api/flipp/flyerkit': {
        target: 'https://api.flipp.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/flipp\/flyerkit/, '/flyerkit/v4.0/publications'),
      },
    },
  },
});
