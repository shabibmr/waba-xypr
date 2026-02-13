import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConversationList } from '../../components/ConversationComponents';
import { mockConversations } from '../../test/fixtures';

describe('ConversationList', () => {
    const mockOnSelect = vi.fn();
    const mockOnOpenWidget = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render conversation list', () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            expect(screen.getByText('Conversations')).toBeInTheDocument();
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
            expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
            expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
        });

        it('should show empty state when no conversations', () => {
            render(
                <ConversationList
                    conversations={[]}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            expect(screen.getByText('No conversations yet')).toBeInTheDocument();
        });

        it('should highlight selected conversation', () => {
            const { container } = render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId="conv-1"
                />
            );

            const selectedButton = container.querySelector('button.bg-gray-700');
            expect(selectedButton).toBeInTheDocument();
        });
    });

    describe('Search Functionality', () => {
        it('should filter conversations by name', async () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const searchInput = screen.getByPlaceholderText('Search by name or number...');
            fireEvent.change(searchInput, { target: { value: 'Alice' } });

            await waitFor(() => {
                expect(screen.getByText('Alice Smith')).toBeInTheDocument();
                expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
                expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
            });
        });

        it('should filter conversations by phone number', async () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const searchInput = screen.getByPlaceholderText('Search by name or number...');
            fireEvent.change(searchInput, { target: { value: '+2222222222' } });

            await waitFor(() => {
                expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
                expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
                expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
            });
        });

        it('should be case-insensitive', async () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const searchInput = screen.getByPlaceholderText('Search by name or number...');
            fireEvent.change(searchInput, { target: { value: 'ALICE' } });

            await waitFor(() => {
                expect(screen.getByText('Alice Smith')).toBeInTheDocument();
            });
        });

        it('should show no matching message when search has no results', async () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const searchInput = screen.getByPlaceholderText('Search by name or number...');
            fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

            await waitFor(() => {
                expect(screen.getByText('No matching conversations')).toBeInTheDocument();
            });
        });
    });

    describe('Status Filter', () => {
        it('should filter active conversations', async () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const filterSelect = screen.getByRole('combobox');
            fireEvent.change(filterSelect, { target: { value: 'active' } });

            await waitFor(() => {
                expect(screen.getByText('Alice Smith')).toBeInTheDocument();
                expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
                expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
            });
        });

        it('should filter closed conversations', async () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const filterSelect = screen.getByRole('combobox');
            fireEvent.change(filterSelect, { target: { value: 'closed' } });

            await waitFor(() => {
                expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
                expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
                expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
            });
        });

        it('should combine search and filter', async () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const searchInput = screen.getByPlaceholderText('Search by name or number...');
            const filterSelect = screen.getByRole('combobox');

            fireEvent.change(filterSelect, { target: { value: 'active' } });
            fireEvent.change(searchInput, { target: { value: 'Alice' } });

            await waitFor(() => {
                expect(screen.getByText('Alice Smith')).toBeInTheDocument();
                expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
                expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
            });
        });
    });

    describe('User Interactions', () => {
        it('should call onSelect when conversation clicked', () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            const conversation = screen.getByText('Alice Smith');
            fireEvent.click(conversation);

            expect(mockOnSelect).toHaveBeenCalledWith(mockConversations[0]);
        });

        it('should display unread count badge', () => {
            render(
                <ConversationList
                    conversations={mockConversations}
                    onSelect={mockOnSelect}
                    selectedId={null}
                />
            );

            expect(screen.getByText('2')).toBeInTheDocument(); // Alice's unread count
            expect(screen.getByText('1')).toBeInTheDocument(); // Charlie's unread count
        });
    });
});
