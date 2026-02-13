import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import conversationService from '../services/conversationService';

/**
 * React Query hook for managing conversations
 */
export const useConversations = () => {
    return useQuery({
        queryKey: ['conversations'],
        queryFn: async () => {
            const data = await conversationService.getConversations();
            return data.conversations || [];
        },
    });
};

/**
 * React Query hook for fetching messages for a specific conversation
 */
export const useConversationMessages = (conversationId) => {
    return useQuery({
        queryKey: ['conversation-messages', conversationId],
        queryFn: async () => {
            if (!conversationId) return [];
            const data = await conversationService.getMessages(conversationId);
            return data.messages || [];
        },
        enabled: !!conversationId,
    });
};

/**
 * Mutation hook for sending messages
 */
export const useSendMessage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (messageData) => {
            return await conversationService.sendMessage(messageData);
        },
        onSuccess: (_, variables) => {
            // Invalidate and refetch conversation messages
            queryClient.invalidateQueries(['conversation-messages', variables.conversationId]);
            // Invalidate conversations list to update last message
            queryClient.invalidateQueries(['conversations']);
        },
    });
};
