"use client";

/**
 * Custom hook for chat functionality
 *
 * Simplified implementation adapted from crisis-help-chatbot.
 * Follows React hooks best practices.
 */

import { useCallback } from 'react';
import { useChatContext } from '../context/ChatContext';
import {
  sendChatMessage,
  generateMessageId,
} from '../../lib/api-service';
import type { ChatRequest, ChatResponse } from '../../types/api';

export const useChat = () => {
  const {
    conversation,
    isLoading,
    error,
    addUserMessage,
    addAssistantMessage,
    updateStreamingMessage,
    setLoading,
    setError,
  } = useChatContext();

  /**
   * Send a message to the chatbot
   *
   * @param message - User's message text
   */
  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) {
        return;
      }

      // Clear any previous errors
      setError(null);
      setLoading(true);

      // Add user message to conversation
      addUserMessage(message);

      // Prepare request
      const request: ChatRequest = {
        message,
        conversationId: conversation?.id,
        sessionId: conversation?.sessionId,
        language: conversation?.language || 'auto',
      };

      const assistantMessageId = generateMessageId();

      try {
        // Send message and wait for response
        const response = await sendChatMessage(request);
        addAssistantMessage(assistantMessageId, response);
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        setLoading(false);

        // Add error message to conversation
        addAssistantMessage(assistantMessageId, {
          response: {
            story: {
              title: 'Error',
              narrative: errorMessage,
            },
            exploreFurther: ['Try asking your question again'],
          },
          responseType: 'error',
          conversationId: conversation?.id || '',
          sessionId: conversation?.sessionId || '',
          language: conversation?.language || 'en',
          processingTime: 0,
          translationUsed: false,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [
      conversation,
      isLoading,
      addUserMessage,
      addAssistantMessage,
      setLoading,
      setError,
    ]
  );

  return {
    sendMessage,
    isLoading,
    error,
    conversation,
  };
};
