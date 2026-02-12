/**
 * Application error codes enum — FRD Section 10.1
 */
const ERROR_CODES = {
    // Authentication errors
    AUTH_001: 'AUTH_001', // Invalid or expired token
    AUTH_002: 'AUTH_002', // No token provided
    AUTH_003: 'AUTH_003', // Insufficient permissions
    AUTH_004: 'AUTH_004', // Token blacklisted / revoked
    AUTH_005: 'AUTH_005', // User not found or inactive

    // Onboarding errors
    ONBOARD_001: 'ONBOARD_001', // Invalid step number
    ONBOARD_002: 'ONBOARD_002', // Step prerequisite not met
    ONBOARD_003: 'ONBOARD_003', // Genesys credential validation failed
    ONBOARD_004: 'ONBOARD_004', // Onboarding already completed
    ONBOARD_005: 'ONBOARD_005', // Onboarding state expired

    // Conversation errors
    CONV_001: 'CONV_001', // Conversation not found
    CONV_002: 'CONV_002', // Conversation already assigned
    CONV_003: 'CONV_003', // Invalid transfer target

    // Message errors
    MSG_001: 'MSG_001', // Missing required fields
    MSG_002: 'MSG_002', // WhatsApp not configured
    MSG_003: 'MSG_003', // Message delivery failed

    // Dashboard errors
    DASH_001: 'DASH_001', // Metrics fetch failed
    DASH_002: 'DASH_002', // Invalid date range

    // Validation errors
    VALIDATION_001: 'VALIDATION_001', // Request body validation failed
    VALIDATION_002: 'VALIDATION_002', // Query parameter validation failed
    VALIDATION_003: 'VALIDATION_003', // Path parameter validation failed

    // System errors
    SYSTEM_001: 'SYSTEM_001', // Internal server error
    SYSTEM_002: 'SYSTEM_002', // External service unavailable
    SYSTEM_003: 'SYSTEM_003', // Database error
};

module.exports = ERROR_CODES;
