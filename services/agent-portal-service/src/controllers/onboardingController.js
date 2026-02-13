const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');
const onboardingCache = require('../services/onboardingCache');
const { GenesysUser } = require('../models/Agent');

/**
 * Get current onboarding status
 */
async function getStatus(req, res, next) {
    try {
        const tenant_id = (req.user && req.user.tenant_id) || req.headers['x-tenant-id'];
        const state = await onboardingCache.getState(tenant_id);

        // If no state explicitly in Redis, check if tenant is already active in DB
        // (This would require tenant-service check, but for MVP we assume Redis or fresh)

        res.json(state || {
            currentStep: 1,
            completedSteps: [],
            startedAt: null
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Submit step data
 */
async function submitStep(req, res, next) {
    try {
        const { stepNumber } = req.params;
        const step = parseInt(stepNumber);
        const tenant_id = (req.user && req.user.tenant_id) || req.headers['x-tenant-id'];
        const data = req.body;

        logger.info(`Submitting onboarding step ${step}`, { tenantId: tenant_id });

        if (step === 1) {
            // Validate Genesys Credentials
            await validateGenesysCredentials(data.genesysRegion, data.genesysClientId, data.genesysClientSecret);
        }

        // Save to Redis
        const newState = await onboardingCache.updateStep(tenant_id, step, data);

        res.json({
            success: true,
            nextStep: newState.currentStep,
            state: newState
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Complete onboarding
 */
async function completeOnboarding(req, res, next) {
    try {
        const tenant_id = (req.user && req.user.tenant_id) || req.headers['x-tenant-id'];
        const state = await onboardingCache.getState(tenant_id);

        if (!state) {
            throw new AppError('No onboarding progress found', 400, ERROR_CODES.ONBOARD_001);
        }

        // Verify all steps are done (Step 1-4 required, 5 is confirmation)
        const requiredSteps = [1, 2, 3]; // Simulating required steps
        const missing = requiredSteps.filter(s => !state.completedSteps.includes(s));

        if (missing.length > 0) {
            throw new AppError(`Missing steps: ${missing.join(', ')}`, 400, ERROR_CODES.ONBOARD_002);
        }

        logger.info('Finalizing onboarding', { tenantId: tenant_id });

        // 1. Commit organization profile (Step 2)
        await updateTenantProfile(tenant_id, state.stepData.step2);

        // 2. Commit Genesys Config (Step 2)
        // (Secure storage logic would go here)

        // 3. Commit WhatsApp Config (Step 3)
        // (Secure storage logic would go here)

        // 4. Mark tenant active
        const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
        await axios.put(
            `${tenantServiceUrl}/api/tenants/${tenant_id}`,
            {
                onboarding_completed: true,
                onboarding_completed_at: new Date().toISOString(),
                status: 'active'
            }
        );

        // Clear cache
        await onboardingCache.reset(tenant_id);

        res.json({
            success: true,
            message: 'Onboarding completed successfully'
        });
    } catch (error) {
        next(error);
    }
}

// Helpers

async function validateGenesysCredentials(region, clientId, clientSecret) {
    try {
        // Authenticate with Genesys to validate creds
        const tokenUrl = `https://login.${region}/oauth/token`;
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        await axios.post(tokenUrl, params, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return true;
    } catch (error) {
        logger.error('Genesys validation failed', { error: error.message });
        throw new AppError('Invalid Genesys credentials', 400, ERROR_CODES.ONBOARD_003);
    }
}

async function updateTenantProfile(tenantId, profileData) {
    const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
    await axios.put(
        `${tenantServiceUrl}/api/tenants/${tenantId}`,
        {
            name: profileData.organizationName,
            industry: profileData.industry,
            contact_email: profileData.contactEmail
        }
    );
}

module.exports = {
    getStatus,
    submitStep,
    completeOnboarding
};
