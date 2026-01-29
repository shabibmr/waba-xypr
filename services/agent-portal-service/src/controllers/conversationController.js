const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { GenesysUser, ConversationAssignment } = require('../models/Agent');

/**
 * Get all conversations for the user's tenant
 */
async function getConversations(req, res, next) {
    try {
        const userId = req.userId;
        const user = req.user;
        const { limit = 20, offset = 0 } = req.query;

        logger.info('Fetching conversations for user', { userId, tenantId: user.tenant_id });

        // Get user's assigned conversations
        const assignments = await ConversationAssignment.findByUser(userId);
        const conversationIds = assignments.map(a => a.conversation_id);

        // Fetch conversation details from state-manager
        const conversations = [];

        // In a real implementation, we'd query state-manager with tenant_id filter
        // For now, returning assignments
        for (const assignment of assignments) {
            try {
                const response = await axios.get(
                    `${config.services.stateManager}/state/conversation/${assignment.conversation_id}`,
                    {
                        headers: { 'X-Tenant-ID': user.tenant_id }
                    }
                );

                conversations.push({
                    ...response.data,
                    assigned_at: assignment.assigned_at,
                    last_activity: assignment.last_activity_at
                });
            } catch (error) {
                logger.error('Failed to fetch conversation from state-manager', {
                    conversationId: assignment.conversation_id,
                    error: error.message
                });
            }
        }

        res.json({
            conversations,
            total: conversations.length,
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
