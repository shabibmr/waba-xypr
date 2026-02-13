import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import conversationService from '../../services/conversationService';

vi.mock('axios');

describe('ConversationService', () => {
    const API_BASE_URL = 'http://localhost:3000';
    const mockToken = 'test-access-token';

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.setItem('agent_access_token', mockToken);
    });

    describe('getConversations', () => {
        it('should fetch conversations successfully', async () => {
            const mockConversations = {
                conversations: [
                    { conversation_id: '1', contact_name: 'Alice' },
                    { conversation_id: '2', contact_name: 'Bob' }
                ]
            };

            axios.get.mockResolvedValue({ data: mockConversations });

            const result = await conversationService.getConversations();

            expect(axios.get).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/conversations`,
                { headers: { Authorization: `Bearer ${mockToken}` } }
            );
            expect(result).toEqual(mockConversations);
        });

        it('should handle fetch error', async () => {
            axios.get.mockRejectedValue({
                response: { data: { error: 'Unauthorized' } }
            });

            await expect(conversationService.getConversations())
                .rejects.toThrow('Unauthorized');
        });

        it('should handle network error with default message', async () => {
            axios.get.mockRejectedValue(new Error('Network failure'));

            await expect(conversationService.getConversations())
                .rejects.toThrow('Failed to fetch conversations');
        });
    });

    describe('getMessages', () => {
        const conversationId = 'conv-123';

        it('should fetch messages for a conversation', async () => {
            const mockMessages = {
                messages: [
                    { id: 'msg-1', text: 'Hello' },
                    { id: 'msg-2', text: 'Hi there' }
                ]
            };

            axios.get.mockResolvedValue({ data: mockMessages });

            const result = await conversationService.getMessages(conversationId);

            expect(axios.get).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
                { headers: { Authorization: `Bearer ${mockToken}` } }
            );
            expect(result).toEqual(mockMessages);
        });

        it('should handle messages fetch error', async () => {
            axios.get.mockRejectedValue({
                response: { data: { error: 'Conversation not found' } }
            });

            await expect(conversationService.getMessages(conversationId))
                .rejects.toThrow('Conversation not found');
        });
    });

    describe('sendMessage', () => {
        it('should send a message successfully', async () => {
            const messageData = {
                conversationId: 'conv-123',
                to: '+1234567890',
                text: 'Hello, customer!'
            };

            const responseData = {
                message_id: 'msg-456',
                status: 'sent'
            };

            axios.post.mockResolvedValue({ data: responseData });

            const result = await conversationService.sendMessage(messageData);

            expect(axios.post).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/messages/send`,
                {
                    to: messageData.to,
                    text: messageData.text
                },
                { headers: { Authorization: `Bearer ${mockToken}` } }
            );
            expect(result).toEqual(responseData);
        });

        it('should handle send message error', async () => {
            axios.post.mockRejectedValue({
                response: { data: { error: 'Message failed to send' } }
            });

            await expect(conversationService.sendMessage({
                to: '+1111111111',
                text: 'Test'
            })).rejects.toThrow('Message failed to send');
        });

        it('should include text and recipient in request', async () => {
            const messageData = {
                to: '+9876543210',
                text: 'Test message'
            };

            axios.post.mockResolvedValue({ data: {} });

            await conversationService.sendMessage(messageData);

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    to: messageData.to,
                    text: messageData.text
                }),
                expect.any(Object)
            );
        });
    });

    describe('Authorization', () => {
        it('should include authorization header in all requests', async () => {
            axios.get.mockResolvedValue({ data: {} });
            axios.post.mockResolvedValue({ data: {} });

            await conversationService.getConversations();
            await conversationService.getMessages('conv-1');
            await conversationService.sendMessage({ to: '+1', text: 'Hi' });

            const calls = [
                ...axios.get.mock.calls,
                ...axios.post.mock.calls
            ];

            calls.forEach(call => {
                expect(call[call.length - 1].headers).toHaveProperty('Authorization');
                expect(call[call.length - 1].headers.Authorization).toBe(`Bearer ${mockToken}`);
            });
        });
    });
});
