import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3006,
        proxy: {
            '/api': {
                target: process.env.VITE_API_GATEWAY || 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            },
            '/tenants': {
                target: 'http://localhost:3007',
                changeOrigin: true
            },
            '/auth': {
                target: 'http://localhost:3004',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
});
