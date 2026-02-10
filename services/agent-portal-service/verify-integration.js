/**
 * Integration Verification Script
 * Tests integration between agent-portal-service, tenant-service, and auth-service
 */

const axios = require('axios');
const chalk = require('chalk');

const AGENT_PORTAL_SERVICE = process.env.AGENT_PORTAL_SERVICE_URL || 'http://localhost:3015';
const TENANT_SERVICE = process.env.TENANT_SERVICE_URL || 'http://localhost:3007';
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'http://localhost:3004';

// Test Results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = '') {
    const status = passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
    console.log(`${status} - ${name}`);
    if (details) {
        console.log(chalk.gray(`  ${details}`));
    }
    results.tests.push({ name, passed, details });
    if (passed) results.passed++;
    else results.failed++;
}

function logSection(title) {
    console.log('\n' + chalk.blue.bold(`═══ ${title} ═══`));
}

async function testServiceHealth(name, url) {
    try {
        const response = await axios.get(`${url}/health`, { timeout: 5000 });
        logTest(`${name} health check`, response.status === 200, `Status: ${response.status}`);
        return true;
    } catch (error) {
        logTest(`${name} health check`, false, `Error: ${error.message}`);
        return false;
    }
}

async function testTenantProvisioning() {
    try {
        // Test data for a mock Genesys organization
        const testGenesysOrg = {
            genesysOrgId: 'test-org-' + Date.now(),
            genesysOrgName: 'Test Organization',
            genesysRegion: 'mypurecloud.com'
        };

        // Test 1: Provision a new tenant
        const provisionResponse = await axios.post(
            `${TENANT_SERVICE}/api/tenants/provision/genesys`,
            testGenesysOrg
        );

        const tenantCreated = provisionResponse.status === 200 && provisionResponse.data.tenant_id;
        logTest('Tenant auto-provisioning (create)', tenantCreated,
            `Tenant ID: ${provisionResponse.data.tenant_id}`);

        if (!tenantCreated) return;

        const tenantId = provisionResponse.data.tenant_id;

        // Test 2: Provision same org again (should return existing)
        const reprovisionResponse = await axios.post(
            `${TENANT_SERVICE}/api/tenants/provision/genesys`,
            testGenesysOrg
        );

        const tenantReused = reprovisionResponse.data.tenant_id === tenantId;
        logTest('Tenant auto-provisioning (reuse)', tenantReused,
            `Same tenant ID: ${tenantReused}`);

        // Test 3: Get tenant by ID
        const getResponse = await axios.get(`${TENANT_SERVICE}/api/tenants/${tenantId}`);
        logTest('Get tenant by ID', getResponse.status === 200 && getResponse.data.tenant_id === tenantId);

        // Test 4: Get tenant by Genesys Org ID
        const getByOrgResponse = await axios.get(
            `${TENANT_SERVICE}/api/tenants/by-genesys-org/${testGenesysOrg.genesysOrgId}`
        );
        logTest('Get tenant by Genesys Org ID',
            getByOrgResponse.status === 200 && getByOrgResponse.data.tenant_id === tenantId);

        // Test 5: Update tenant
        const updateResponse = await axios.patch(
            `${TENANT_SERVICE}/api/tenants/${tenantId}`,
            {
                name: 'Updated Test Organization',
                plan: 'premium'
            }
        );
        logTest('Update tenant profile',
            updateResponse.status === 200 && updateResponse.data.tenant.name === 'Updated Test Organization');

        // Test 6: Multi-tenant isolation (create different org)
        const secondGenesysOrg = {
            genesysOrgId: 'test-org-2-' + Date.now(),
            genesysOrgName: 'Second Test Organization',
            genesysRegion: 'mypurecloud.com'
        };

        const secondProvisionResponse = await axios.post(
            `${TENANT_SERVICE}/api/tenants/provision/genesys`,
            secondGenesysOrg
        );

        const isolationWorks = secondProvisionResponse.data.tenant_id !== tenantId;
        logTest('Multi-tenant isolation', isolationWorks,
            `Different tenant IDs: ${tenantId} vs ${secondProvisionResponse.data.tenant_id}`);

        // Cleanup
        try {
            await axios.delete(`${TENANT_SERVICE}/api/tenants/${tenantId}`);
            await axios.delete(`${TENANT_SERVICE}/api/tenants/${secondProvisionResponse.data.tenant_id}`);
            logTest('Cleanup test tenants', true);
        } catch (err) {
            logTest('Cleanup test tenants', false, `Error: ${err.message}`);
        }

    } catch (error) {
        logTest('Tenant provisioning integration', false,
            `Error: ${error.response?.data?.error || error.message}`);
    }
}

async function testOrganizationProfile() {
    // This would require a valid JWT token from Genesys OAuth
    // For now, we'll just check if the endpoints exist
    try {
        const response = await axios.put(
            `${AGENT_PORTAL_SERVICE}/api/organization/profile`,
            { organizationName: 'Test Org' }
        );
        // Expect 401 without auth
        logTest('Organization profile endpoint exists', false, 'Unexpected success without auth');
    } catch (error) {
        const endpointExists = error.response?.status === 401;
        logTest('Organization profile endpoint exists', endpointExists,
            `Expected 401, got ${error.response?.status || 'error'}`);
    }
}

async function testGenesysCredentials() {
    try {
        // Create a test tenant first
        const testTenant = await axios.post(`${TENANT_SERVICE}/api/tenants/`, {
            tenantId: 'test-creds-' + Date.now(),
            name: 'Test Creds Tenant'
        });

        const tenantId = testTenant.data.tenant.tenant_id;

        // Test setting credentials
        const setCreds = await axios.put(
            `${TENANT_SERVICE}/api/tenants/${tenantId}/genesys/credentials`,
            {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                region: 'mypurecloud.com',
                integrationId: 'test-integration-id'
            }
        );

        logTest('Set Genesys credentials', setCreds.status === 200);

        // Test getting credentials (should be masked)
        const getCreds = await axios.get(
            `${TENANT_SERVICE}/api/tenants/${tenantId}/genesys/credentials`
        );

        const credsMasked = getCreds.data.clientSecret.includes('***');
        logTest('Get Genesys credentials (masked)', credsMasked,
            `Secret: ${getCreds.data.clientSecret}`);

        // Cleanup
        await axios.delete(`${TENANT_SERVICE}/api/tenants/${tenantId}`);

    } catch (error) {
        logTest('Genesys credentials management', false,
            `Error: ${error.response?.data?.error || error.message}`);
    }
}

async function testAuthService() {
    try {
        // Check if auth-service is being used
        // Currently, agent-portal-service handles OAuth directly
        const response = await axios.get(`${AUTH_SERVICE}/health`);

        logTest('Auth service running', response.status === 200);

        console.log(chalk.yellow('\n  Note: Currently agent-portal-service handles OAuth directly.'));
        console.log(chalk.yellow('  Auth-service exists but is not used for Genesys OAuth.'));
        console.log(chalk.yellow('  This is acceptable for the current architecture.'));

    } catch (error) {
        logTest('Auth service running', false, `Error: ${error.message}`);
    }
}

async function runAllTests() {
    console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║   Service Integration Verification Tests     ║'));
    console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════╝\n'));

    // Health Checks
    logSection('Service Health Checks');
    const agentPortalHealthy = await testServiceHealth('Agent Portal Service', AGENT_PORTAL_SERVICE);
    const tenantServiceHealthy = await testServiceHealth('Tenant Service', TENANT_SERVICE);
    const authServiceHealthy = await testServiceHealth('Auth Service', AUTH_SERVICE);

    if (!agentPortalHealthy || !tenantServiceHealthy) {
        console.log(chalk.red('\n⚠️  Required services are not running. Please start services first:'));
        console.log(chalk.gray('   ./manage.sh start'));
        process.exit(1);
    }

    // Tenant Service Integration
    logSection('Tenant Service Integration');
    await testTenantProvisioning();
    await testGenesysCredentials();

    // Agent Portal Service Integration
    logSection('Agent Portal Service Integration');
    await testOrganizationProfile();

    // Auth Service Check
    logSection('Auth Service Architecture');
    await testAuthService();

    // Summary
    console.log('\n' + chalk.cyan.bold('═══ Test Summary ═══'));
    console.log(chalk.green(`Passed: ${results.passed}`));
    console.log(chalk.red(`Failed: ${results.failed}`));
    console.log(chalk.blue(`Total:  ${results.passed + results.failed}`));

    if (results.failed > 0) {
        console.log('\n' + chalk.red.bold('❌ Some tests failed. Please review the errors above.'));
        process.exit(1);
    } else {
        console.log('\n' + chalk.green.bold('✅ All integration tests passed!'));
        process.exit(0);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
});
