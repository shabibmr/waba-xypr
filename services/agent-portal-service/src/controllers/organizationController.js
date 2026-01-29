const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { GenesysUser } = require('../models/Agent');

/**
 * Fetch and sync organization users from Genesys
 * Requires admin role
 */
async function syncOrganizationUsers(req, res, next) {
    try {
        const user = req.user;
        const { tenant_id } = user;

        // Only admins can sync users
        if (user.role !== 'admin') {
            logger.warn('Non-admin user attempted to sync organization users', { userId: user.user_id });
            return res.status(403).json({ error: 'Admin access required' });
        }

        logger.info('Starting organization user sync', { tenantId: tenant_id });

        // Fetch all users from Genesys (handle pagination)
        let allUsers = [];
        let pageNumber = 1;
        let hasMore = true;

        // Use the genesys-api-service URL directly from config or environment
        // Assuming config.services.genesysApiService is defined, otherwise fallback to service name
        const genesysServiceUrl = config.services?.genesysApiService || 'http://genesys-api-service:3010';

        while (hasMore) {
            const response = await axios.get(
                `${genesysServiceUrl}/genesys/organization/users`,
                {
                    headers: {
                        'X-Tenant-ID': tenant_id
                    },
                    params: {
                        pageSize: 100,
                        pageNumber
                    }
                }
            );

            allUsers.push(...response.data.users);
            hasMore = pageNumber < response.data.pageCount;
            pageNumber++;
        }

        // Sync users to database
        const syncResults = {
            created: 0,
            updated: 0,
            skipped: 0,
            total: allUsers.length
        };

        for (const genesysUser of allUsers) {
            try {
                // Determine if we should create or update
                const existingUser = await GenesysUser.findByGenesysUserId(genesysUser.id);

                if (existingUser) {
                    // Update existing user
                    await GenesysUser.updateFromGenesys(existingUser.user_id, genesysUser);
                    syncResults.updated++;
                } else {
                    // Create new user
                    await GenesysUser.createFromGenesys(genesysUser, tenant_id);
                    syncResults.created++;
                }
            } catch (error) {
                logger.error('Error syncing user from Genesys', {
                    genesysUserId: genesysUser.id,
                    error: error.message
                });
                syncResults.skipped++;
            }
        }

        logger.info('Organization user sync completed', {
            tenantId: tenant_id,
            results: syncResults
        });

        res.json({
            success: true,
            message: 'Organization users synced successfully',
            results: syncResults
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get organization users (from local database)
 */
async function getOrganizationUsers(req, res, next) {
    try {
        const user = req.user;
        const { tenant_id } = user;

        // Supervisors and admins can see all users
        if (!['admin', 'supervisor'].includes(user.role)) {
            logger.warn('User without permission attempted to view organization users', {
                userId: user.user_id,
                role: user.role
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        logger.info('Fetching organization users', { tenantId: tenant_id });

        const users = await GenesysUser.findByTenant(tenant_id);

        res.json({
            users: users.map(u => ({
                user_id: u.user_id,
                name: u.name,
                email: u.genesys_email,
                role: u.role,
                is_active: u.is_active,
                last_login_at: u.last_login_at,
                created_at: u.created_at
            })),
            total: users.length
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    syncOrganizationUsers,
    getOrganizationUsers
};
