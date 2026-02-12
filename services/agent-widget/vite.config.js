import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    root: 'src/client',
    build: {
        outDir: '../public',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3012',
            '/socket.io': { target: 'http://localhost:3015', ws: true },
        },
    },
});
