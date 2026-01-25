#!/usr/bin/env node

/**
 * Script to set up Genesys credentials for a tenant
 * Usage: node scripts/setup-genesys-creds.js <tenant-id>
 */

const axios = require('axios');

const TENANT_SERVICE_URL = process.env.TENANT_SERVICE_URL || 'http://localhost:3007';

const GENESYS_CREDENTIALS = {
    clientId: '7c513299-40e9-4c51-a34f-935bd56cfb56',
    clientSecret: '-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo',
    region: 'aps1.mypurecloud.com'
};

async function setupGenesysCredentials(tenantId) {
    try {
        console.log(`Setting up Genesys credentials for tenant: ${tenantId}`);

        const response = await axios.put(
            `${TENANT_SERVICE_URL}/api/tenants/${tenantId}/genesys/credentials`,
            GENESYS_CREDENTIALS
        );

        console.log('✅ Genesys credentials configured successfully!');
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Error setting up Genesys credentials:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

// Main execution
const tenantId = process.argv[2];

if (!tenantId) {
    console.error('Usage: node setup-genesys-creds.js <tenant-id>');
    console.error('Example: node setup-genesys-creds.js acme_corp');
    process.exit(1);
}

setupGenesysCredentials(tenantId);
