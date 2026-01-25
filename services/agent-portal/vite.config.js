import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3014,
        proxy: {
            '/api': {
                target: process.env.VITE_API_GATEWAY || 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});
