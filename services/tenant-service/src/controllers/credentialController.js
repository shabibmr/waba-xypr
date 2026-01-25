const credentialService = require('../services/credentialService');

async function storeCredentials(req, res) {
    const { tenantId } = req.params;
    const { type, credentials } = req.body;

    if (!type || !credentials) {
        return res.status(400).json({ error: 'type and credentials required' });
    }

    try {
        const credentialId = await credentialService.storeCredentials(tenantId, type, credentials);
        res.json({
            success: true,
            credentialId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getCredentials(req, res) {
    const { tenantId, type } = req.params;

    try {
        const credentials = await credentialService.getCredentials(tenantId, type);

        if (!credentials) {
            return res.status(404).json({ error: 'Credentials not found' });
        }

        res.json(credentials);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    storeCredentials,
    getCredentials
};
