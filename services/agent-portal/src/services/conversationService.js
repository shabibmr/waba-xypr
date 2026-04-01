import axios from 'axios';
import authService from './authService';

import { API_BASE_URL } from './apiConfig';

class ConversationService {
    /**
     * Get all conversations for the agent
     */
    async getConversations(params = {}) {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
                params,
                headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch conversations');
        }
    }

    /**
     * Get specific conversation details
     */
    async getConversation(conversationId) {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/conversations/${conversationId}`,
                { headers: { Authorization: `Bearer ${authService.getAccessToken()}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch conversation');
        }
    }

    /**
     * Get message history for a conversation
     */
    async getMessages(conversationId, params = {}) {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
                {
                    params,
                    headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch messages');
        }
    }
}

export default new ConversationService();
