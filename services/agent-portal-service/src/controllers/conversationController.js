const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { GenesysUser, ConversationAssignment } = require('../models/Agent');
const socketEmitter = require('../services/socketEmitter');

/**
 * Get all conversations for the user's tenant
 */
const Conversation = require('../models/Conversation');

/**
 * Get all conversations for the user's tenant
 */
async function getConversations(req, res, next) {
    try {
        const userId = req.userId;
        const user = req.user;
        const { limit = 20, offset = 0 } = req.query;

        logger.info('Fetching conversations for user', { userId, tenantId: user.tenant_id });

        // Get tenant's WhatsApp config to find phone_number_id
        const tenantConfig = await GenesysUser.getTenantWhatsAppConfig(userId);

        if (!tenantConfig || !tenantConfig.phone_number_id) {
            logger.warn('No WhatsApp config found for tenant', { tenantId: user.tenant_id });
            return res.json({
                conversations: [],
                total: 0,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        }

        const phoneNumberId = tenantConfig.phone_number_id;

        // Fetch all conversations for the tenant's phone number
        const conversations = await Conversation.findAllByPhoneNumberId(phoneNumberId, limit, offset);
        const total = await Conversation.countByPhoneNumberId(phoneNumberId);

        // Enhance with details from state-manager if needed, 
        // but Conversation model already fetches from conversation_mappings which has most invalid info.
        // If state-manager has more ephemeral state, we could merge it here, 
        // but for listing, the mapping table + assignment info should be sufficient.
        // However, the original code fetched from state-manager. 
        // Let's stick to the data we have from DB for now to ensure speed and reliability.
        // We might need to fetch last message or other details if they are not in mapping.
        // Checking schema: conversation_mappings has `last_message_id`, `contact_name`, `status`.
        // It does NOT have the actual message content.
        // The original code: `response.data` from state-manager likely included more.
        // But let's start with this. The frontend likely needs `id`, `contact_name`, `last_message`, `status`, `assigned_to`.

        // We need to fetch the actual last message content if possible.
        // For now, let's return what we have. Frontend might fetch messages separately or we might need a join.
        // But relying on state-manager for list might be heavy if we have many.

        // Transform for frontend if necessary.
        // The previous return format was whatever state-manager returned + assignment.
        // state-manager getConversation returns `conversation_mappings` row basically.

        res.json({
            conversations,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get specific conversation
 */
async function getConversation(req, res, next) {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;
        const user = req.user;

        logger.info('Fetching conversation details', { conversationId, userId });

        // Check if conversation is assigned
        const assignment = await ConversationAssignment.findByConversation(conversationId);

        // Fetch from state-manager with tenant filter
        const response = await axios.get(
            `${config.services.stateManager}/state/conversation/${conversationId}`,
            {
                headers: { 'X-Tenant-ID': user.tenant_id }
            }
        );

        const conversation = response.data;

        // Add assignment info
        if (assignment) {
            conversation.assigned_to = {
                user_id: assignment.user_id,
                user_name: assignment.user_name,
                user_role: assignment.user_role,
                assigned_at: assignment.assigned_at
            };
            conversation.is_assigned_to_me = assignment.user_id === userId;
        } else {
            conversation.assigned_to = null;
            conversation.is_assigned_to_me = false;
        }

        res.json(conversation);
    } catch (error) {
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        next(error);
    }
}

/**
 * Get messages for a conversation
 */
async function getMessages(req, res, next) {
    try {
        const { conversationId } = req.params;
        const user = req.user;
        const { limit = 50, offset = 0 } = req.query;

        logger.info('Fetching conversation messages', { conversationId, limit, offset });

        // Fetch from state-manager with tenant filter
        const response = await axios.get(
            `${config.services.stateManager}/state/conversation/${conversationId}/messages`,
            {
                params: { limit, offset },
                headers: { 'X-Tenant-ID': user.tenant_id }
            }
        );

        res.json(response.data);
    } catch (error) {
        next(error);
    }
}

/**
 * Assign conversation to current user
 */
async function assignToMe(req, res, next) {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;
        const user = req.user;

        logger.info('Assigning conversation to user', { conversationId, userId });

        const assignment = await ConversationAssignment.assign(conversationId, userId, user.tenant_id);

        // Emit update
        socketEmitter.emitConversationUpdate(user.tenant_id, {
            id: conversationId,
            assigned_to: {
                user_id: user.user_id,
                user_name: user.name,
                assigned_at: new Date()
            },
            status: 'assigned' // Assuming status change
        });

        res.json({
            message: 'Conversation assigned successfully',
            assignment
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Transfer conversation to another user (supervisor/admin only)
 */
async function transferConversation(req, res, next) {
    try {
        const { conversationId } = req.params;
        const { to_user_id } = req.body;
        const userId = req.userId;
        const user = req.user;

        if (!['admin', 'supervisor'].includes(user.role)) {
            return res.status(403).json({ error: 'Only supervisors and admins can transfer conversations' });
        }

        // Verify target user is in same tenant
        const targetUser = await GenesysUser.findById(to_user_id);
        if (!targetUser || targetUser.tenant_id !== user.tenant_id) {
            logger.warn('Invalid transfer target user', { to_user_id, tenantId: user.tenant_id });
            return res.status(400).json({ error: 'Invalid target user' });
        }

        logger.info('Transferring conversation', {
            conversationId,
            fromUserId: userId,
            toUserId: to_user_id
        });

        const assignment = await ConversationAssignment.transfer(conversationId, userId, to_user_id);

        // Emit update
        socketEmitter.emitConversationUpdate(user.tenant_id, {
            id: conversationId,
            assigned_to: {
                user_id: targetUser.user_id,
                user_name: targetUser.name,
                assigned_at: new Date()
            },
            status: 'assigned'
        });

        res.json({
            message: 'Conversation transferred successfully',
            assignment
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getConversations,
    getConversation,
    getMessages,
    assignToMe,
    transferConversation
};
