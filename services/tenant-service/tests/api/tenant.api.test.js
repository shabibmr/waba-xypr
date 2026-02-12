'use strict';

/**
 * API integration tests for tenant-service.
 *
 * Strategy: mock the service layer so tests go through the full
 * Express route → controller → (mocked service) path without needing
 * a live DB or Redis.  This verifies routing, validation, HTTP status
 * codes, and response shapes.
 */

// ── Infrastructure stubs (loaded at module startup by controllers) ────────────
jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('redis', () => ({
    createClient: jest.fn(() => ({
        isReady: true, on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        ping: jest.fn().mockResolvedValue('PONG'),
        keys: jest.fn().mockResolvedValue([]),
    })),
}));
jest.mock('../../src/config/redis', () => ({
    isReady: true, isOpen: true, on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
}));

// ── Service mocks ─────────────────────────────────────────────────────────────
jest.mock('../../src/services/tenantService');
jest.mock('../../src/services/whatsappService');
jest.mock('../../src/services/credentialService');

const request = require('supertest');
const app = require('../../src/app');
const tenantService = require('../../src/services/tenantService');
const whatsappService = require('../../src/services/whatsappService');
const credentialService = require('../../src/services/credentialService');
const pool = require('../../src/config/database');
const redisClient = require('../../src/config/redis');

const { formattedTenant, dbWhatsAppConfigRow } = require('../fixtures/tenants');
const TENANT_ID = 't_abc123def456abc1';

// ─────────────────────────────────────────────────────────────────────────────

describe('Tenant Service API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // health-check stubs
        pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
        redisClient.ping.mockResolvedValue('PONG');
    });

    // ── GET /health ───────────────────────────────────────────────────────────

    describe('GET /health', () => {
        it('returns 200 healthy with timestamp', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('healthy');
            expect(res.body.database).toBe('connected');
            expect(res.body.redis).toBe('connected');
            expect(res.body).toHaveProperty('timestamp');
        });
    });

    // ── POST /tenants ─────────────────────────────────────────────────────────

    describe('POST /tenants', () => {
        it('returns 201 with camelCase tenant and apiKey', async () => {
            tenantService.createTenant.mockResolvedValue({
                tenant: formattedTenant,
                apiKey: 'sk_testkey123',
            });

            const res = await request(app)
                .post('/tenants')
                .send({ name: 'Acme Corp', email: 'admin@acme.com' });

            expect(res.status).toBe(201);
            expect(res.body.tenant.id).toBe(TENANT_ID);
            expect(res.body.tenant.email).toBe('admin@acme.com');
            expect(res.body.apiKey).toBe('sk_testkey123');
            expect(res.body.message).toBe('Tenant created successfully');
        });

        it('response uses camelCase — no snake_case fields', async () => {
            tenantService.createTenant.mockResolvedValue({
                tenant: formattedTenant,
                apiKey: 'sk_x',
            });

            const res = await request(app)
                .post('/tenants')
                .send({ name: 'X', email: 'x@x.com' });

            expect(res.status).toBe(201);
            expect(res.body.tenant).not.toHaveProperty('tenant_id');
            expect(res.body.tenant).not.toHaveProperty('rate_limit');
            expect(res.body.tenant).toHaveProperty('rateLimit');
        });

        it('returns 400 when name is missing', async () => {
            const res = await request(app)
                .post('/tenants')
                .send({ email: 'admin@acme.com' });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 when email is missing', async () => {
            const res = await request(app)
                .post('/tenants')
                .send({ name: 'Acme Corp' });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('returns 409 on unique-constraint violation (PG code 23505)', async () => {
            const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
            tenantService.createTenant.mockRejectedValue(pgErr);

            const res = await request(app)
                .post('/tenants')
                .send({ name: 'Acme Corp', email: 'admin@acme.com' });
            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('CONFLICT');
        });

        it('does not accept client-supplied tenantId', async () => {
            tenantService.createTenant.mockResolvedValue({
                tenant: formattedTenant,
                apiKey: 'sk_x',
            });

            await request(app)
                .post('/tenants')
                .send({ tenantId: 'custom-id', name: 'X', email: 'x@x.com' });

            // Service is called without tenantId in the args
            const callArg = tenantService.createTenant.mock.calls[0][0];
            expect(callArg).not.toHaveProperty('tenantId', 'custom-id');
        });
    });

    // ── GET /tenants ──────────────────────────────────────────────────────────

    describe('GET /tenants', () => {
        it('returns paginated list', async () => {
            tenantService.getAllTenants.mockResolvedValue({
                tenants: [formattedTenant],
                total: 1,
                limit: 20,
                offset: 0,
            });

            const res = await request(app).get('/tenants');
            expect(res.status).toBe(200);
            expect(res.body.tenants).toHaveLength(1);
            expect(res.body.total).toBe(1);
            expect(res.body).toHaveProperty('limit');
            expect(res.body).toHaveProperty('offset');
        });

        it('forwards limit and offset query params', async () => {
            tenantService.getAllTenants.mockResolvedValue({
                tenants: [], total: 50, limit: 10, offset: 30,
            });

            await request(app).get('/tenants?limit=10&offset=30');
            expect(tenantService.getAllTenants).toHaveBeenCalledWith({ limit: 10, offset: 30 });
        });

        it('caps limit at 100', async () => {
            tenantService.getAllTenants.mockResolvedValue({
                tenants: [], total: 0, limit: 100, offset: 0,
            });

            await request(app).get('/tenants?limit=500');
            expect(tenantService.getAllTenants).toHaveBeenCalledWith({ limit: 100, offset: 0 });
        });
    });

    // ── GET /tenants/:id ──────────────────────────────────────────────────────

    describe('GET /tenants/:tenantId', () => {
        it('returns camelCase tenant', async () => {
            tenantService.getTenantById.mockResolvedValue(formattedTenant);

            const res = await request(app).get(`/tenants/${TENANT_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(TENANT_ID);
            expect(res.body).toHaveProperty('rateLimit');
            expect(res.body).not.toHaveProperty('rate_limit');
        });

        it('returns 404 when tenant not found', async () => {
            tenantService.getTenantById.mockResolvedValue(null);

            const res = await request(app).get('/tenants/no-such-id');
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });

    // ── PATCH /tenants/:id ────────────────────────────────────────────────────

    describe('PATCH /tenants/:tenantId', () => {
        it('updates and returns updated tenant', async () => {
            const updated = { ...formattedTenant, name: 'Acme Updated' };
            tenantService.updateTenant.mockResolvedValue(updated);

            const res = await request(app)
                .patch(`/tenants/${TENANT_ID}`)
                .send({ name: 'Acme Updated' });

            expect(res.status).toBe(200);
            expect(res.body.tenant.name).toBe('Acme Updated');
        });

        it('returns 404 when tenant not found', async () => {
            tenantService.updateTenant.mockRejectedValue(new Error('Tenant not found'));

            const res = await request(app)
                .patch(`/tenants/${TENANT_ID}`)
                .send({ name: 'X' });

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });

    // ── DELETE /tenants/:id ───────────────────────────────────────────────────

    describe('DELETE /tenants/:tenantId', () => {
        it('returns 200 success message', async () => {
            tenantService.deleteTenant.mockResolvedValue(formattedTenant);

            const res = await request(app).delete(`/tenants/${TENANT_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Tenant deleted successfully');
        });

        it('returns 404 when not found', async () => {
            tenantService.deleteTenant.mockRejectedValue(new Error('Tenant not found'));

            const res = await request(app).delete(`/tenants/${TENANT_ID}`);
            expect(res.status).toBe(404);
        });
    });

    // ── PUT /tenants/:id/genesys/credentials ──────────────────────────────────

    describe('PUT /tenants/:tenantId/genesys/credentials', () => {
        const creds = {
            clientId: 'client-123',
            clientSecret: 'secret-abc',
            region: 'mypurecloud.com',
            integrationId: 'intg-001',
        };

        it('stores credentials and returns success', async () => {
            tenantService.setGenesysCredentials.mockResolvedValue({
                ...formattedTenant,
                genesysRegion: 'mypurecloud.com',
                genesysIntegrationId: 'intg-001',
                ...creds,
            });

            const res = await request(app)
                .put(`/tenants/${TENANT_ID}/genesys/credentials`)
                .send(creds);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Genesys credentials updated successfully');
            expect(res.body.tenant.genesysRegion).toBe('mypurecloud.com');
        });

        it('returns 400 when any field is missing', async () => {
            const res = await request(app)
                .put(`/tenants/${TENANT_ID}/genesys/credentials`)
                .send({ clientId: 'only-this' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ── GET /tenants/:id/genesys/credentials ──────────────────────────────────

    describe('GET /tenants/:tenantId/genesys/credentials', () => {
        it('returns masked clientSecret', async () => {
            tenantService.getGenesysCredentials.mockResolvedValue({
                clientId: 'client-123',
                clientSecret: 'secret-abcxyz',
                region: 'mypurecloud.com',
                integrationId: 'intg-001',
            });

            const res = await request(app).get(`/tenants/${TENANT_ID}/genesys/credentials`);
            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(true);
            expect(res.body.clientId).toBe('client-123');
            expect(res.body.clientSecret).toMatch(/^\*\*\*/);
            expect(res.body.clientSecret).not.toBe('secret-abcxyz');
        });

        it('returns 404 when not configured', async () => {
            tenantService.getGenesysCredentials.mockResolvedValue(null);

            const res = await request(app).get(`/tenants/${TENANT_ID}/genesys/credentials`);
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });

    // ── GET /tenants/by-phone/:phoneNumberId ──────────────────────────────────
    // Note: handled by whatsappController (whatsappRoutes registered first)

    describe('GET /tenants/by-phone/:phoneNumberId', () => {
        it('returns { tenantId } when found', async () => {
            whatsappService.getTenantByPhoneNumberId.mockResolvedValue({
                tenant_id: TENANT_ID,
            });

            const res = await request(app).get('/tenants/by-phone/15550001234');
            expect(res.status).toBe(200);
            expect(res.body.tenantId).toBe(TENANT_ID);
        });

        it('returns 404 when not found', async () => {
            whatsappService.getTenantByPhoneNumberId.mockResolvedValue(null);

            const res = await request(app).get('/tenants/by-phone/99999');
            expect(res.status).toBe(404);
        });
    });

    // ── GET /tenants/by-integration/:integrationId ────────────────────────────

    describe('GET /tenants/by-integration/:integrationId', () => {
        it('returns full formatted tenant when found', async () => {
            tenantService.getTenantByIntegrationId.mockResolvedValue({
                ...formattedTenant,
                genesysIntegrationId: 'intg-001',
            });

            const res = await request(app).get('/tenants/by-integration/intg-001');
            expect(res.status).toBe(200);
            expect(res.body.genesysIntegrationId).toBe('intg-001');
        });

        it('returns 404 when not found', async () => {
            tenantService.getTenantByIntegrationId.mockResolvedValue(null);

            const res = await request(app).get('/tenants/by-integration/no-such');
            expect(res.status).toBe(404);
        });
    });

    // ── POST /tenants/:id/credentials (credentialRoutes) ─────────────────────

    describe('POST /tenants/:tenantId/credentials', () => {
        it('stores credential and returns credentialId', async () => {
            credentialService.storeCredentials.mockResolvedValue(42);

            const res = await request(app)
                .post(`/tenants/${TENANT_ID}/credentials`)
                .send({ type: 'genesys', credentials: { clientId: 'x', clientSecret: 'y' } });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.credentialId).toBe(42);
        });

        it('returns 400 when type is missing', async () => {
            const res = await request(app)
                .post(`/tenants/${TENANT_ID}/credentials`)
                .send({ credentials: { clientId: 'x' } });

            expect(res.status).toBe(400);
        });
    });

    // ── GET /tenants/:id/credentials/:type (credentialRoutes) ────────────────

    describe('GET /tenants/:tenantId/credentials/:type', () => {
        it('returns credentials', async () => {
            credentialService.getCredentials.mockResolvedValue({
                clientId: 'client-123',
                clientSecret: 'secret-abc',
                region: 'mypurecloud.com',
            });

            const res = await request(app).get(`/tenants/${TENANT_ID}/credentials/genesys`);
            expect(res.status).toBe(200);
            expect(res.body.clientId).toBe('client-123');
        });

        it('returns 404 when not found', async () => {
            credentialService.getCredentials.mockResolvedValue(null);

            const res = await request(app).get(`/tenants/${TENANT_ID}/credentials/whatsapp`);
            expect(res.status).toBe(404);
        });
    });
});
