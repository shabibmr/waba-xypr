const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Creates a new OAuth Client in Genesys Cloud
 * 
 * @param {string} name - The name of the new OAuth Client
 * @param {string} description - Description for the client
 * @param {Array<string>} redirectUris - Authorized redirect URIs
 * @param {Array<string>} authorizedGrantTypes - e.g., ['TOKEN', 'CLIENT_CREDENTIALS']
 * @param {Array<string>} roleIds - Required if grant types include CLIENT_CREDENTIALS
 * @returns {Promise<Object>} The created OAuth Client details (id, secret)
 */
async function createOAuthClient(name, description, redirectUris, authorizedGrantTypes, roleIds = []) {
    // We need an existing Admin or high-privilege Bearer token to create OAuth clients
    // Typically, you might use an existing Client Credentials token to automate this

    // For this script, we'll assume we authenticate with existing credentials from .env
    // or you pass in a master token. Let's get a token first if we have MASTER credentials.

    const region = process.env.GENESYS_REGION || 'mypurecloud.com';
    const authUrl = `https://login.${region}/oauth/token`;
    const apiUrl = `https://api.${region}/api/v2/oauth/clients`;

    // We need existing credentials that have the 'oauth:client:add' permission
    const existingClientId = process.env.GENESYS_CLIENT_ID;
    const existingClientSecret = process.env.GENESYS_CLIENT_SECRET;

    if (!existingClientId || !existingClientSecret) {
        throw new Error("Missing GENESYS_CLIENT_ID or GENESYS_CLIENT_SECRET in environment to authenticate.");
    }

    try {
        let accessToken = process.env.GENESYS_ADMIN_TOKEN;

        if (!accessToken) {
            // 1. Authenticate to get an admin token using client credentials
            console.log('No GENESYS_ADMIN_TOKEN found. Authenticating using GENESYS_CLIENT_ID to get access token...');
            const authString = Buffer.from(`${existingClientId}:${existingClientSecret}`).toString('base64');

            try {
                const authResponse = await axios.post(
                    authUrl,
                    'grant_type=client_credentials',
                    {
                        headers: {
                            'Authorization': `Basic ${authString}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );
                accessToken = authResponse.data.access_token;
                console.log('Authentication successful.');
            } catch (authError) {
                console.error('\n❌ Authentication Failed!');
                console.error('The GENESYS_CLIENT_ID in your .env does not have the "Client Credentials" grant type enabled, or it lacks the required permissions (oauth:client:add).');
                console.error('\n👉 WORKAROUND: Generate a token manually in the Genesys Cloud Developer Center (API Explorer) and add it to your .env as:\nGENESYS_ADMIN_TOKEN=your_token_here\n');
                throw authError;
            }
        } else {
            console.log('Using provided GENESYS_ADMIN_TOKEN for authentication.');
        }

        // 2. Create the new OAuth Client
        console.log(`Creating new OAuth Client: ${name}...`);

        const clientPayload = {
            name: name,
            description: description,
            authorizedGrantTypes: authorizedGrantTypes, // Fixed: Changed from authorizedGrantType to authorizedGrantTypes (plural)
            accessTokenValiditySeconds: 86400, // 24 hours
            state: "active"
        };

        if (redirectUris && redirectUris.length > 0) {
            clientPayload.registeredRedirectUri = redirectUris;
        }

        if (roleIds && roleIds.length > 0) {
            clientPayload.roleIds = roleIds;
        }

        const createResponse = await axios.post(
            apiUrl,
            clientPayload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const newClient = createResponse.data;

        console.log('OAuth Client created successfully!');
        console.log('-----------------------------------');
        console.log(`Client Name: ${newClient.name}`);
        console.log(`Client ID: ${newClient.id}`);
        console.log(`Client Secret: ${newClient.secret}`);
        console.log('-----------------------------------');

        return {
            id: newClient.id,
            secret: newClient.secret,
            name: newClient.name
        };

    } catch (error) {
        console.error('Error creating OAuth client:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw error;
    }
}

// Example usage if run directly
if (require.main === module) {
    // You can modify these parameters
    const clientName = "Agent Widget Implicit Client Auto";
    const clientDesc = "Auto-generated implicit client for Agent Widget auth";

    // The redirect URI configured for your widget
    const widgetUrl = process.env.WIDGET_PUBLIC_URL || 'http://localhost:3012';
    const redirectUris = [`${widgetUrl}/widget`];

    // 'TOKEN' is the correct grant type for Implicit browser grant
    // Note: Implicit grants do NOT return a secret, only an ID
    const grantTypes = ['TOKEN'];

    createOAuthClient(clientName, clientDesc, redirectUris, grantTypes)
        .then(result => {
            console.log("\nUpdate your .env with this new Client ID:");
            console.log(`GENESYS_WIDGET_CLIENT_ID=${result.id}`);
            if (result.secret) {
                console.log(`GENESYS_WIDGET_CLIENT_SECRET=${result.secret}`);
            }
        })
        .catch(err => {
            console.error("Failed to create client:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
        });
}

module.exports = { createOAuthClient };
