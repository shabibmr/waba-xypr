/**
 * Response Helper Utilities
 * Handles OAuth callback responses and error formatting
 */

/**
 * Send OAuth success response
 * Returns HTML page with window.postMessage script for popup flow
 * @param {Object} res - Express response object
 * @param {Object} tokens - Token pair (accessToken, refreshToken, expiresIn)
 * @param {Object} tenant - Tenant data
 * @param {Object} organization - Genesys organization data
 * @param {Object} user - User data
 */
function sendOAuthSuccessResponse(res, tokens, tenant, organization, user) {
    const payload = {
        type: 'GENESYS_AUTH_SUCCESS',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        isNewTenant: tenant.isNew || false,
        onboardingCompleted: tenant.onboardingCompleted || false,
        genesysOrg: {
            name: organization.name,
            domain: organization.domain,
            id: organization.id
        },
        agent: {
            user_id: user.user_id,
            name: user.name,
            email: user.genesys_email,
            role: user.role,
            tenant_id: user.tenant_id,
            isNewTenant: tenant.isNew || false,
            onboardingCompleted: tenant.onboardingCompleted || false
        }
    };

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Authenticating...</title>
</head>
<body>
<script>
  (function() {
    var data = ${JSON.stringify(payload)};
    window.opener.postMessage(data, '*');
    window.close();
  })();
</script>
<p>Authentication successful. This window should close automatically.</p>
</body>
</html>`;

    res.send(html);
}

/**
 * Send OAuth error response
 * Returns HTML page with error message for popup flow
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 */
function sendOAuthErrorResponse(res, error) {
    const errorMessage = error.message || 'Authentication failed';

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Error</title>
</head>
<body>
<script>
  (function() {
    if (window.opener) {
      window.opener.postMessage({
        type: 'GENESYS_AUTH_ERROR',
        error: ${JSON.stringify(errorMessage)}
      }, '*');
    }
    window.close();
  })();
</script>
<p>Authentication failed: ${errorMessage}. This window should close automatically.</p>
</body>
</html>`;

    res.send(html);
}

module.exports = {
    sendOAuthSuccessResponse,
    sendOAuthErrorResponse
};
