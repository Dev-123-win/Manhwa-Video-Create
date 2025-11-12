import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Cast 'process' to 'any' to resolve TypeScript error for 'cwd' property.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // This is crucial for ffmpeg.wasm to work
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    }
  }
});