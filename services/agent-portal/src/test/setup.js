import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock environment variables
globalThis.import = {
    meta: {
        env: {
            VITE_API_GATEWAY: 'http://localhost:3000'
        }
    }
};

// Mock sessionStorage
const sessionStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock
});

// Mock window.crypto for PKCE tests
Object.defineProperty(window, 'crypto', {
    value: {
        getRandomValues: (arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        },
        subtle: {
            digest: vi.fn((algorithm, data) => {
                // Simple mock - returns a hash-like ArrayBuffer
                const hash = new Uint8Array(32);
                for (let i = 0; i < 32; i++) {
                    hash[i] = i;
                }
                return Promise.resolve(hash.buffer);
            })
        }
    }
});
