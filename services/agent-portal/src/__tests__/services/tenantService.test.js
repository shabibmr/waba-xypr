import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import tenantService from '../../services/tenantService';
import authService from '../../services/authService';

vi.mock('axios');
vi.mock('../../services/authService');

describe('TenantService', () => {
    const API_BASE_URL = 'http://localhost:3000';

    beforeEach(() => {
        vi.clearAllMocks();
        authService.getAccessToken.mockReturnValue('test-token-123');
    });

    describe('updateProfile', () => {
        it('should update organization profile successfully', async () => {
            const profileData = {
                organizationName: 'Test Org',
                email: 'test@example.com',
                timezone: 'America/New_York'
            };

            const responseData = { success: true, profile: profileData };
            axios.put.mockResolvedValue({ data: responseData });

            const result = await tenantService.updateProfile(profileData);

            expect(axios.put).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/organization/profile`,
                profileData,
                { headers: { Authorization: 'Bearer test-token-123' } }
            );
            expect(result).toEqual(responseData);
        });

        it('should handle update profile error', async () => {
            const profileData = { organizationName: 'Test' };
            axios.put.mockRejectedValue({
                response: { data: { error: 'Update failed' } }
            });

            await expect(tenantService.updateProfile(profileData))
                .rejects.toThrow('Update failed');
        });

        it('should handle network error with default message', async () => {
            axios.put.mockRejectedValue(new Error('Network error'));

            await expect(tenantService.updateProfile({}))
                .rejects.toThrow('Failed to update profile');
        });
    });

    describe('updateGenesysCredentials', () => {
        it('should update Genesys credentials successfully', async () => {
            const credentials = {
                clientId: 'client-123',
                clientSecret: 'secret-456',
                region: 'us-east-1'
            };

            const responseData = { success: true };
            axios.put.mockResolvedValue({ data: responseData });

            const result = await tenantService.updateGenesysCredentials(credentials);

            expect(axios.put).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/organization/genesys-credentials`,
                credentials,
                { headers: { Authorization: 'Bearer test-token-123' } }
            );
            expect(result).toEqual(responseData);
        });

        it('should handle credentials update error', async () => {
            axios.put.mockRejectedValue({
                response: { data: { error: 'Invalid credentials' } }
            });

            await expect(tenantService.updateGenesysCredentials({}))
                .rejects.toThrow('Invalid credentials');
        });
    });

    describe('completeOnboarding', () => {
        it('should complete onboarding successfully', async () => {
            const tenantId = 'tenant-123';
            const setupData = {
                whatsapp: { waba_id: '12345' },
                genesys: { clientId: 'abc' }
            };

            const responseData = { success: true };
            axios.post.mockResolvedValue({ data: responseData });

            const result = await tenantService.completeOnboarding(tenantId, setupData);

            expect(axios.post).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/tenants/${tenantId}/complete-onboarding`,
                setupData,
                { headers: { Authorization: 'Bearer test-token-123' } }
            );
            expect(result).toEqual(responseData);
        });

        it('should handle onboarding error', async () => {
            axios.post.mockRejectedValue({
                response: { data: { error: 'Onboarding failed' } }
            });

            await expect(tenantService.completeOnboarding('tenant-1', {}))
                .rejects.toThrow('Onboarding failed');
        });
    });

    describe('getProfile', () => {
        it('should fetch organization profile successfully', async () => {
            const profileData = {
                id: 'org-123',
                name: 'Test Organization',
                email: 'org@test.com'
            };

            axios.get.mockResolvedValue({ data: profileData });

            const result = await tenantService.getProfile();

            expect(axios.get).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/organization/profile`,
                { headers: { Authorization: 'Bearer test-token-123' } }
            );
            expect(result).toEqual(profileData);
        });

        it('should handle fetch profile error', async () => {
            axios.get.mockRejectedValue({
                response: { data: { error: 'Not found' } }
            });

            await expect(tenantService.getProfile())
                .rejects.toThrow('Not found');
        });

        it('should include authorization header', async () => {
            axios.get.mockResolvedValue({ data: {} });

            await tenantService.getProfile();

            expect(axios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-token-123'
                    })
                })
            );
        });
    });
});
