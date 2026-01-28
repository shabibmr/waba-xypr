/**
 * Extract template components from message text
 * @param {string} text - Message text containing template markers
 * @returns {Array} Array of template components
 */
export function extractTemplateComponents(text: string) {
    const components: any[] = [];

    // Extract body parameters
    const bodyMatch = text.match(/{{BODY:(.*?)}}/s);
    if (bodyMatch) {
        const params = bodyMatch[1].split('|').map(p => p.trim());
        components.push({
            type: 'body',
            parameters: params.map(p => ({ type: 'text', text: p }))
        });
    }

    // Extract button parameters
    const buttonMatch = text.match(/{{BUTTON:(.*?)}}/);
    if (buttonMatch) {
        components.push({
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [{ type: 'text', text: buttonMatch[1] }]
        });
    }

    return components;
}

/**
 * Check if text contains URL
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains URL
 */
export function containsUrl(text: string) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return urlPattern.test(text);
}
