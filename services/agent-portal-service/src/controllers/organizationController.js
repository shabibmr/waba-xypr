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

/**
 * Update organization profile
 */
async function updateOrganizationProfile(req, res, next) {
    try {
        const user = req.user;
        const { tenant_id } = user;
        const { organizationName, email, domain, industry, companySize, country, timezone } = req.body;

        logger.info('Updating organization profile - REQUEST RECEIVED', {
            tenantId: tenant_id,
            body: req.body
        });

        // Call tenant-service to update profile
        const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
        const updateUrl = `${tenantServiceUrl}/api/tenants/${tenant_id}`;
        const updateData = {
            name: organizationName,
            email,
            domain,
            industry,
            company_size: companySize,
            country,
            timezone
        };

        logger.info('Sending PATCH request to tenant-service', {
            url: updateUrl,
            method: 'PATCH',
            data: updateData
        });

        const response = await axios.patch(updateUrl, updateData);

        logger.info('Organization profile updated successfully', {
            tenantId: tenant_id,
            status: response.status,
            data: response.data
        });

        res.json({
            success: true,
            message: 'Organization profile updated successfully',
            profile: response.data
        });
    } catch (error) {
        logger.error('Organization profile update error', {
            error: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status,
            tenantId: req.user?.tenant_id
        });
        next(error);
    }
}

/**
 * Get organization profile
 */
async function getOrganizationProfile(req, res, next) {
    try {
        const user = req.user;
        const { tenant_id } = user;

        logger.info('Fetching organization profile', { tenantId: tenant_id });

        // Call tenant-service to get profile
        const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';

        const response = await axios.get(
            `${tenantServiceUrl}/api/tenants/${tenant_id}`
        );

        res.json({
            success: true,
            profile: response.data
        });
    } catch (error) {
        logger.error('Organization profile fetch error', {
            error: error.message,
            tenantId: req.user?.tenant_id
        });
        next(error);
    }
}



/**
 * Update organization logo
 */
async function updateLogo(req, res, next) {
    try {
        if (!req.file) {
            throw new AppError('No logo file uploaded', 400, ERROR_CODES.VAL_001);
        }

        const { tenant_id } = req.user;
        const file = req.file;

        // Upload to MinIO (or your storage service)
        // For MVP, assuming we have a storage service helper or using direct storage logic
        // If no helper exists yet, we'll implement a basic one or mock it

        // Mocking URL for now or implementation depends on existing MinIO availability
        // Since messageController uses multer, we assume storage is set up there or we need a service

        const logoUrl = `https://minio.yourdomain.com/logos/${tenant_id}/${file.filename}`;

        // Update Tenant Service
        const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
        await axios.put(
            `${tenantServiceUrl}/api/tenants/${tenant_id}`,
            {
                logo_url: logoUrl
            }
        );

        res.json({
            success: true,
            logoUrl
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    syncOrganizationUsers,
    getOrganizationUsers,
    updateOrganizationProfile,
    getOrganizationProfile,
    updateLogo
};
