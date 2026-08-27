import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
 const env = loadEnv(mode, '.', '');
 return {
 server: {
 port: 3000,
 host: '0.0.0.0',
 },
 plugins: [react()],
 define: {
 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
 },
 resolve: {
 alias: {
 '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-error-boundary')) {
                return 'vendor-react';
              }
              if (id.includes('node_modules/@google/genai')) {
                return 'vendor-genai';
              }
              if (id.includes('node_modules/@fingerprintjs')) {
                return 'vendor-fingerprint';
              }
            },
          },
        },
      },
    };
});
