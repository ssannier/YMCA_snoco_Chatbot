"use client";

/**
 * Chat Context for managing global chat state
 *
 * This context provides chat state and actions throughout the application.
 * It follows React best practices with proper typing and state management.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Message, Conversation } from '../../types/api';
import { generateSessionId, generateMessageId } from '../../lib/api-service';

interface ChatContextType {
  conversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  addUserMessage: (content: string) => string;
  addAssistantMessage: (id: string, content: any) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearConversation: () => void;
  setLanguage: (language: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const [conversation, setConversation] = useState<Conversation | null>(() => {
    // Initialize with a new conversation
    return {
      id: generateSessionId(),
      sessionId: generateSessionId(),
      messages: [],
      language: 'auto',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addUserMessage = useCallback((content: string): string => {
    const messageId = generateMessageId();
    const newMessage: Message = {
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setConversation((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...prev.messages, newMessage],
        updatedAt: new Date(),
      };
    });

    return messageId;
  }, []);

  const addAssistantMessage = useCallback((id: string, content: any) => {
    const newMessage: Message = {
      id,
      role: 'assistant',
      content,
      timestamp: new Date(),
      isStreaming: false,
    };

    setConversation((prev) => {
      if (!prev) return null;

      // Check if message already exists (from streaming)
      const existingIndex = prev.messages.findIndex((msg) => msg.id === id);

      if (existingIndex >= 0) {
        // Update existing message
        const updatedMessages = [...prev.messages];
        updatedMessages[existingIndex] = newMessage;
        return {
          ...prev,
          messages: updatedMessages,
          updatedAt: new Date(),
        };
      }

      // Add new message
      return {
        ...prev,
        messages: [...prev.messages, newMessage],
        updatedAt: new Date(),
      };
    });
  }, []);

  const updateStreamingMessage = useCallback((id: string, content: string) => {
    setConversation((prev) => {
      if (!prev) return null;

      const existingIndex = prev.messages.findIndex((msg) => msg.id === id);

      if (existingIndex >= 0) {
        // Update existing streaming message
        const updatedMessages = [...prev.messages];
        updatedMessages[existingIndex] = {
          ...updatedMessages[existingIndex],
          content,
          isStreaming: true,
        };
        return {
          ...prev,
          messages: updatedMessages,
          updatedAt: new Date(),
        };
      }

      // Create new streaming message
      const newMessage: Message = {
        id,
        role: 'assistant',
        content,
        timestamp: new Date(),
        isStreaming: true,
      };

      return {
        ...prev,
        messages: [...prev.messages, newMessage],
        updatedAt: new Date(),
      };
    });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const handleSetError = useCallback((errorMessage: string | null) => {
    setError(errorMessage);
  }, []);

  const clearConversation = useCallback(() => {
    setConversation({
      id: generateSessionId(),
      sessionId: generateSessionId(),
      messages: [],
      language: conversation?.language || 'auto',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setError(null);
  }, [conversation?.language]);

  const setLanguage = useCallback((language: string) => {
    setConversation((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        language,
        updatedAt: new Date(),
      };
    });
  }, []);

  const value: ChatContextType = {
    conversation,
    isLoading,
    error,
    addUserMessage,
    addAssistantMessage,
    updateStreamingMessage,
    setLoading,
    setError: handleSetError,
    clearConversation,
    setLanguage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

/**
 * Hook to use chat context
 *
 * @throws Error if used outside ChatProvider
 */
export const useChatContext = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
