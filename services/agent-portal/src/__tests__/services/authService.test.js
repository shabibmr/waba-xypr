import { describe, it, expect, beforeEach, vi } from 'vitest';
import authService from '../../services/authService';

describe('AuthService', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    describe('PKCE OAuth Flow', () => {
        it('should generate a valid code verifier', () => {
            const verifier = authService.generateCodeVerifier();

            expect(verifier).toBeDefined();
            expect(verifier.length).toBe(43);
            expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe base64
        });

        it('should generate different verifiers each time', () => {
            const verifier1 = authService.generateCodeVerifier();
            const verifier2 = authService.generateCodeVerifier();

            expect(verifier1).not.toBe(verifier2);
        });

        it('should generate a code challenge from verifier', async () => {
            const verifier = 'test-verifier-123';
            const challenge = await authService.generateCodeChallenge(verifier);

            expect(challenge).toBeDefined();
            expect(typeof challenge).toBe('string');
            expect(challenge.length).toBeGreaterThan(0);
        });

        it('should base64 URL encode correctly', () => {
            const input = new Uint8Array([255, 254, 253]);
            const encoded = authService.base64UrlEncode(input);

            expect(encoded).toBeDefined();
            expect(encoded).not.toContain('+');
            expect(encoded).not.toContain('/');
            expect(encoded).not.toContain('=');
        });
    });

    describe('sessionStorage Management', () => {
        it('should store access token in sessionStorage', () => {
            const token = 'test-access-token-123';
            authService.setAccessToken(token);

            expect(sessionStorage.getItem('agent_access_token')).toBe(token);
        });

        it('should retrieve access token from sessionStorage', () => {
            const token = 'test-access-token-456';
            sessionStorage.setItem('agent_access_token', token);

            expect(authService.getAccessToken()).toBe(token);
        });

        it('should store refresh token in sessionStorage', () => {
            const token = 'test-refresh-token-789';
            authService.setRefreshToken(token);

            expect(sessionStorage.getItem('agent_refresh_token')).toBe(token);
        });

        it('should retrieve refresh token from sessionStorage', () => {
            const token = 'test-refresh-token-abc';
            sessionStorage.setItem('agent_refresh_token', token);

            expect(authService.getRefreshToken()).toBe(token);
        });

        it('should store agent info as JSON in sessionStorage', () => {
            const agent = { id: '123', name: 'John Doe', email: 'john@test.com' };
            authService.setAgent(agent);

            const stored = JSON.parse(sessionStorage.getItem('agent_info'));
            expect(stored).toEqual(agent);
        });

        it('should retrieve agent info from sessionStorage', () => {
            const agent = { id: '456', name: 'Jane Smith', email: 'jane@test.com' };
            sessionStorage.setItem('agent_info', JSON.stringify(agent));

            expect(authService.getAgent()).toEqual(agent);
        });

        it('should return null for missing agent info', () => {
            expect(authService.getAgent()).toBeNull();
        });
    });

    describe('Authentication State', () => {
        it('should return true when access token exists', () => {
            sessionStorage.setItem('agent_access_token', 'valid-token');
            expect(authService.isAuthenticated()).toBe(true);
        });

        it('should return false when no access token', () => {
            expect(authService.isAuthenticated()).toBe(false);
        });
    });

    describe('Logout', () => {
        it('should clear all auth data from sessionStorage', () => {
            authService.setAccessToken('token-1');
            authService.setRefreshToken('token-2');
            authService.setAgent({ id: '123' });
            sessionStorage.setItem('pkce_code_verifier', 'verifier-123');

            authService.clearAuth();

            expect(sessionStorage.getItem('agent_access_token')).toBeNull();
            expect(sessionStorage.getItem('agent_refresh_token')).toBeNull();
            expect(sessionStorage.getItem('agent_info')).toBeNull();
            expect(sessionStorage.getItem('pkce_code_verifier')).toBeNull();
        });
    });

    describe('Login Flow', () => {
        it('should store PKCE verifier when initiating login', () => {
            // Mock window.open
            const mockOpen = vi.fn(() => ({ closed: false }));
            global.window.open = mockOpen;

            authService.initiateGenesysLogin();

            const verifier = sessionStorage.getItem('pkce_code_verifier');
            expect(verifier).toBeDefined();
            expect(verifier.length).toBe(43);
        });

        it('should open popup with correct dimensions', () => {
            const mockOpen = vi.fn(() => ({ closed: false }));
            global.window.open = mockOpen;

            authService.initiateGenesysLogin();

            expect(mockOpen).toHaveBeenCalled();
            const callArgs = mockOpen.mock.calls[0];
            expect(callArgs[1]).toBe('GenesysLogin');
            expect(callArgs[2]).toContain('width=500');
            expect(callArgs[2]).toContain('height=600');
        });
    });

    describe('Token Validation', () => {
        it('should validate presence of access token', () => {
            sessionStorage.setItem('agent_access_token', 'valid-token');
            expect(authService.hasValidToken()).toBe(true);
        });

        it('should return false for missing token', () => {
            expect(authService.hasValidToken()).toBe(false);
        });
    });
});
