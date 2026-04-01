import re

file_path = 'services/agent-portal/src/services/authService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add a simple SHA-256 fallback implementation if crypto.subtle is missing
sha256_fallback = """
/**
 * Fallback SHA-256 for non-secure contexts (HTTP)
 */
const sha256Fallback = async (message) => {
    const msgUint8 = new TextEncoder().encode(message);
    
    // If crypto.subtle is available, use it (Secure Context)
    if (window.crypto && window.crypto.subtle) {
        return await window.crypto.subtle.digest('SHA-256', msgUint8);
    }
    
    // Basic fallback for development (Note: In production, ALWAYS use HTTPS)
    console.warn('[AuthService] crypto.subtle not available. Using unsafe fallback for PKCE challenge.');
    
    // We'll use a simple implementation or just return the verifier as-is 
    // for dev-mode if the backend allows it, but better to try a real hash.
    // Since we can't easily npm install, let's use a standard JS implementation.
    
    return msgUint8; // Temporary bypass - most OAuth providers require actual SHA256 for S256 method
};
"""

# Actually, let's just use a better approach: 
# If crypto.subtle is missing, we are on HTTP. 
# We should recommend the user to use HTTPS/Ngrok or localhost.

# But to make it WORK right now, I will provide a tiny SHA256 impl.
