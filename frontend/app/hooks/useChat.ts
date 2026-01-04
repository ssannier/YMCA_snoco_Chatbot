"use client";

/**
 * Custom hook for chat functionality with streaming support
 *
 * Enhanced implementation with real-time streaming responses.
 * Follows React hooks best practices.
 */

import { useCallback } from 'react';
import { useChatContext } from '../context/ChatContext';
import {
  sendChatMessage,
  sendStreamingChatMessage,
  generateMessageId,
  isStreamingSupported,
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
   * Send a message to the chatbot with streaming support
   *
   * @param message - User's message text
   * @param useStreaming - Whether to use streaming (default: true if supported)
   */
  const sendMessage = useCallback(
    async (message: string, useStreaming: boolean = true) => {
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

      // Decide whether to use streaming
      const shouldStream = useStreaming && isStreamingSupported();

      if (shouldStream) {
        // Use streaming approach
        let streamingContent = '';
        
        // Add initial empty assistant message for streaming updates
        addAssistantMessage(assistantMessageId, {
          response: {
            story: {
              title: 'Thinking...',
              narrative: '',
            },
          },
          responseType: 'streaming',
          conversationId: conversation?.id || '',
          sessionId: conversation?.sessionId || '',
          language: conversation?.language || 'en',
          processingTime: 0,
          translationUsed: false,
          timestamp: new Date().toISOString(),
        });

        try {
          await sendStreamingChatMessage(
            request,
            // onChunk - handle streaming text
            (chunk: string) => {
              streamingContent += chunk;
              
              // Update the streaming message with the accumulated content
              updateStreamingMessage(assistantMessageId, {
                response: {
                  story: {
                    title: 'YMCA Historical Response',
                    narrative: streamingContent,
                  },
                },
                responseType: 'streaming',
                conversationId: conversation?.id || '',
                sessionId: conversation?.sessionId || '',
                language: conversation?.language || 'en',
                processingTime: 0,
                translationUsed: false,
                timestamp: new Date().toISOString(),
              });
            },
            // onComplete - handle final structured response
            (finalResponse: ChatResponse) => {
              // Replace the streaming message with the final structured response
              addAssistantMessage(assistantMessageId, finalResponse);
              setLoading(false);
            },
            // onError - handle streaming errors
            (errorMessage: string) => {
              setError(errorMessage);
              setLoading(false);
              
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
          );
          
          // If streaming completed without onComplete being called, finalize the message
          setLoading(false);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to send streaming message';
          setError(errorMessage);
          setLoading(false);

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
      } else {
        // Use traditional non-streaming approach
        try {
          const response = await sendChatMessage(request);
          addAssistantMessage(assistantMessageId, response);
          setLoading(false);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
          setError(errorMessage);
          setLoading(false);

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
      }
    },
    [
      conversation,
      isLoading,
      addUserMessage,
      addAssistantMessage,
      updateStreamingMessage,
      setLoading,
      setError,
    ]
  );

  return {
    sendMessage,
    isLoading,
    error,
    conversation,
    isStreamingSupported: isStreamingSupported(),
  };
};
