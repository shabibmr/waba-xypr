import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/themes.css';
import './styles/main.css';

async function bootstrap() {
    // Fetch widget config from the server (points to agent-portal-service)
    try {
        const res = await fetch('/api/v1/widget/config');
        if (res.ok) {
            window.__WIDGET_CONFIG__ = await res.json();
        }
    } catch {
        // Fall back to defaults — useful in dev with direct Vite server
        window.__WIDGET_CONFIG__ = {
            apiUrl: 'http://localhost:3015',
            socketUrl: 'http://localhost:3015',
        };
    }

    ReactDOM.createRoot(document.getElementById('root')).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

bootstrap();
