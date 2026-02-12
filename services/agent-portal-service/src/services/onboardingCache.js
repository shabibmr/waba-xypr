const config = require('../config');
const logger = require('../utils/logger');
const { createClient } = require('redis');

class OnboardingCache {
    constructor() {
        this.client = createClient({
            url: config.redis.url
        });

        this.client.on('error', (err) => logger.error('Redis Client Error', err));
        this.client.connect().catch(err => logger.error('Redis Connection Error', err));

        this.TTL = 24 * 60 * 60; // 24 hours
    }

    _getKey(tenantId) {
        return `onboarding:${tenantId}`;
    }

    /**
     * Get current onboarding state
     * @param {string} tenantId 
     * @returns {Promise<object|null>}
     */
    async getState(tenantId) {
        try {
            const data = await this.client.get(this._getKey(tenantId));
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('Redis get error', { error: error.message, tenantId });
            return null;
        }
    }

    /**
     * Save/Update onboarding state
     * @param {string} tenantId 
     * @param {object} state 
     */
    async saveState(tenantId, state) {
        try {
            const key = this._getKey(tenantId);
            await this.client.set(key, JSON.stringify(state), {
                EX: this.TTL
            });
        } catch (error) {
            logger.error('Redis save error', { error: error.message, tenantId });
        }
    }

    /**
     * Update specific step data
     * @param {string} tenantId 
     * @param {number} stepNumber 
     * @param {object} stepData 
     */
    async updateStep(tenantId, stepNumber, stepData) {
        let state = await this.getState(tenantId) || this._getInitialState(tenantId);

        state.stepData[`step${stepNumber}`] = stepData;
        state.currentStep = Math.max(state.currentStep, stepNumber + 1); // Advance to next step

        if (!state.completedSteps.includes(stepNumber)) {
            state.completedSteps.push(stepNumber);
        }

        state.updatedAt = new Date().toISOString();

        await this.saveState(tenantId, state);
        return state;
    }

    /**
     * Reset onboarding state
     * @param {string} tenantId 
     */
    async reset(tenantId) {
        try {
            await this.client.del(this._getKey(tenantId));
        } catch (error) {
            logger.error('Redis delete error', { error: error.message, tenantId });
        }
    }

    _getInitialState(tenantId) {
        return {
            tenantId,
            currentStep: 1,
            completedSteps: [],
            stepData: {},
            startedAt: new Date().toISOString()
        };
    }
}

module.exports = new OnboardingCache();
