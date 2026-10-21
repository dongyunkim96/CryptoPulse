import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import worker from './server/worker.ts';
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-demo-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/api/')) {
            next();
            return;
          }
          // The Vite preview is deliberately credential-free. Wrangler runs the full API.
          const request = new Request(`http://localhost${req.url}`, { method: req.method });
          void worker
            .fetch(request, { ASSETS: {} as Fetcher, DATA_MODE: 'demo' })
            .then(async (response) => {
              res.statusCode = response.status;
              response.headers.forEach((v, k) => res.setHeader(k, v));
              res.end(await response.text());
            })
            .catch(() => {
              res.statusCode = 500;
              res.end('Local demo API unavailable');
            });
        });
      },
    },
  ],
  build: { chunkSizeWarningLimit: 650 },
});
