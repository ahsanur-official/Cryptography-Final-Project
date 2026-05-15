import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'public/index.html'),
        login: path.resolve(__dirname, 'public/login.html'),
        register: path.resolve(__dirname, 'public/register.html'),
        chat: path.resolve(__dirname, 'public/chat.html'),
        proofs: path.resolve(__dirname, 'public/proofs.html'),
        settings: path.resolve(__dirname, 'public/settings.html'),
        proof: path.resolve(__dirname, 'public/proof.html'),
        'two-party': path.resolve(__dirname, 'public/two-party.html')
      }
    }
  }
});
