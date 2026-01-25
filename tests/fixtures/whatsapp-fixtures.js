/**
 * WhatsApp Graph API Response Fixtures
 * Sample responses from Meta's WhatsApp Business API
 */

module.exports = {
    // Successful message send response
    messageSendSuccess: {
        messaging_product: 'whatsapp',
        contacts: [{
            input: '919876543210',
            wa_id: '919876543210'
        }],
        messages: [{
            id: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSQzNDOEY4RjBGNzREQjQ3OTQA'
        }]
    },

    // Token exchange success
    tokenExchangeSuccess: {
        access_token: 'EAABsbCS1iHgBO7ZCqVz4ZCqJZBZCqVz4ZCqJZBZCqVz4ZCqJ',
        token_type: 'bearer'
    },

    // Debug token response
    debugTokenSuccess: {
        data: {
            app_id: '123456789',
            type: 'USER',
            application: 'Test App',
            data_access_expires_at: 1735689600,
            expires_at: 1735689600,
            is_valid: true,
            scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
            granular_scopes: [{
                scope: 'whatsapp_business_management',
                target_ids: ['123456789012345']
            }],
            user_id: '123456789'
        }
    },

    // Phone number details
    phoneNumberDetails: {
        id: '123456789012345',
        display_phone_number: '+1 555-0123',
        verified_name: 'Test Business',
        code_verification_status: 'VERIFIED',
        quality_rating: 'GREEN',
        platform_type: 'CLOUD_API',
        throughput: {
            level: 'STANDARD'
        },
        business_id: '987654321'
    },

    // Media upload response
    mediaUploadSuccess: {
        id: 'media-id-12345'
    },

    // Media URL response
    mediaUrlSuccess: {
        url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=media-id-12345',
        mime_type: 'image/jpeg',
        sha256: 'abc123def456',
        file_size: 123456,
        id: 'media-id-12345',
        messaging_product: 'whatsapp'
    },

    // Template message success
    templateSendSuccess: {
        messaging_product: 'whatsapp',
        contacts: [{
            input: '919876543210',
            wa_id: '919876543210'
        }],
        messages: [{
            id: 'wamid.TEMPLATE123456789'
        }]
    },

    // Mark as read success
    markAsReadSuccess: {
        success: true
    },

    // Error responses
    errors: {
        invalidToken: {
            error: {
                message: 'Invalid OAuth access token.',
                type: 'OAuthException',
                code: 190,
                fbtrace_id: 'ABC123'
            }
        },

        rateLimitExceeded: {
            error: {
                message: 'Rate limit exceeded',
                type: 'OAuthException',
                code: 4,
                fbtrace_id: 'DEF456'
            }
        },

        invalidPhoneNumber: {
            error: {
                message: 'Invalid phone number',
                type: 'InvalidParameterException',
                code: 100,
                error_data: {
                    details: 'Phone number is not a valid WhatsApp number'
                },
                fbtrace_id: 'GHI789'
            }
        },

        mediaDownloadFailed: {
            error: {
                message: 'Media download failed',
                type: 'MediaDownloadException',
                code: 131051,
                fbtrace_id: 'JKL012'
            }
        }
    },

    // Webhook verification challenge
    webhookVerification: {
        challenge: 'test-challenge-string-12345'
    },

    // Incoming message webhook payload
    incomingMessage: {
        object: 'whatsapp_business_account',
        entry: [{
            id: '123456789012345',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '+1 555-0123',
                        phone_number_id: '123456789012345'
                    },
                    contacts: [{
                        profile: {
                            name: 'John Doe'
                        },
                        wa_id: '919876543210'
                    }],
                    messages: [{
                        from: '919876543210',
                        id: 'wamid.INCOMING123456',
                        timestamp: '1704067200',
                        type: 'text',
                        text: {
                            body: 'Hello, I need help!'
                        }
                    }]
                },
                field: 'messages'
            }]
        }]
    },

    // Status update webhook payload
    statusUpdate: {
        object: 'whatsapp_business_account',
        entry: [{
            id: '123456789012345',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '+1 555-0123',
                        phone_number_id: '123456789012345'
                    },
                    statuses: [{
                        id: 'wamid.STATUS123456',
                        status: 'delivered',
                        timestamp: '1704067200',
                        recipient_id: '919876543210',
                        conversation: {
                            id: 'conv-id-12345',
                            origin: {
                                type: 'business_initiated'
                            }
                        },
                        pricing: {
                            billable: true,
                            pricing_model: 'CBP',
                            category: 'business_initiated'
                        }
                    }]
                },
                field: 'messages'
            }]
        }]
    }
};
