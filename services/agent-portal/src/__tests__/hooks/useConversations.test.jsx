import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversations, useConversationMessages, useSendMessage } from '../../hooks/useConversations';
import conversationService from '../../services/conversationService';
import { mockConversations, mockMessages } from '../../test/fixtures';

vi.mock('../../services/conversationService');

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('useConversations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch conversations successfully', async () => {
        conversationService.getConversations.mockResolvedValue({
            conversations: mockConversations
        });

        const { result } = renderHook(() => useConversations(), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(mockConversations);
        expect(conversationService.getConversations).toHaveBeenCalledTimes(1);
    });

    it('should handle loading state', () => {
        conversationService.getConversations.mockReturnValue(
            new Promise(() => { }) // Never resolves
        );

        const { result } = renderHook(() => useConversations(), {
            wrapper: createWrapper()
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    it('should handle error state', async () => {
        const error = new Error('Failed to fetch');
        conversationService.getConversations.mockRejectedValue(error);

        const { result } = renderHook(() => useConversations(), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
    });

    it('should return empty array if no conversations', async () => {
        conversationService.getConversations.mockResolvedValue({
            conversations: []
        });

        const { result } = renderHook(() => useConversations(), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual([]);
    });
});

describe('useConversationMessages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch messages for a conversation', async () => {
        const conversationId = 'conv-123';
        conversationService.getMessages.mockResolvedValue({
            messages: mockMessages
        });

        const { result } = renderHook(() => useConversationMessages(conversationId), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(mockMessages);
        expect(conversationService.getMessages).toHaveBeenCalledWith(conversationId);
    });

    it('should not fetch when conversationId is null', () => {
        const { result } = renderHook(() => useConversationMessages(null), {
            wrapper: createWrapper()
        });

        expect(result.current.data).toBeUndefined();
        expect(conversationService.getMessages).not.toHaveBeenCalled();
    });

    it('should return empty array if no messages', async () => {
        conversationService.getMessages.mockResolvedValue({
            messages: []
        });

        const { result } = renderHook(() => useConversationMessages('conv-1'), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual([]);
    });
});

describe('useSendMessage', () => {
    let queryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });
    });

    it('should send message successfully', async () => {
        const messageData = {
            conversationId: 'conv-123',
            to: '+1234567890',
            text: 'Hello!'
        };

        conversationService.sendMessage.mockResolvedValue({
            message_id: 'msg-456',
            status: 'sent'
        });

        const wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useSendMessage(), { wrapper });

        result.current.mutate(messageData);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(conversationService.sendMessage).toHaveBeenCalledWith(messageData);
    });

    it('should handle send message error', async () => {
        const error = new Error('Send failed');
        conversationService.sendMessage.mockRejectedValue(error);

        const wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useSendMessage(), { wrapper });

        result.current.mutate({
            conversationId: 'conv-1',
            to: '+1111',
            text: 'Test'
        });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeDefined();
    });

    it('should invalidate queries after successful send', async () => {
        const conversationId = 'conv-123';
        conversationService.sendMessage.mockResolvedValue({ success: true });

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useSendMessage(), { wrapper });

        result.current.mutate({
            conversationId,
            to: '+1234',
            text: 'Hi'
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(invalidateSpy).toHaveBeenCalledWith(['conversation-messages', conversationId]);
        expect(invalidateSpy).toHaveBeenCalledWith(['conversations']);
    });
});
