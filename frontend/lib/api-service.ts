/**
 * API Service Layer for YMCA Chatbot
 *
 * Enhanced API service with streaming support for real-time responses.
 * Supports both regular and streaming chat endpoints.
 */

import type { ChatRequest, ChatResponse, ApiError } from '../types/api';

const API_URL = process.env.NEXT_PUBLIC_API_ENDPOINT;
const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_ENDPOINT;

/**
 * Generate a unique session ID for tracking conversations
 */
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Generate a unique message ID
 */
export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Send a chat message to the backend (non-streaming)
 *
 * @param request - Chat request payload
 * @returns Promise<ChatResponse>
 */
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  if (!API_URL) {
    throw new Error('API endpoint not configured. Please set NEXT_PUBLIC_API_ENDPOINT in .env.local');
  }

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        error: 'Network error',
        statusCode: response.status,
      }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data: ChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
};

/**
 * Send a streaming chat message to the backend
 *
 * @param request - Chat request payload
 * @param onChunk - Callback for each streaming chunk
 * @param onComplete - Callback when streaming is complete
 * @param onError - Callback for errors
 */
export const sendStreamingChatMessage = async (
  request: ChatRequest,
  onChunk: (chunk: string) => void,
  onComplete: (finalResponse: ChatResponse) => void,
  onError: (error: string) => void
): Promise<void> => {
  const endpoint = STREAMING_URL || `${API_URL}/chat-stream`;
  
  if (!endpoint) {
    throw new Error('Streaming endpoint not configured. Please set NEXT_PUBLIC_STREAMING_ENDPOINT or NEXT_PUBLIC_API_ENDPOINT in .env.local');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        error: 'Network error',
        statusCode: response.status,
      }));
      onError(errorData.error || `HTTP error! status: ${response.status}`);
      return;
    }

    if (!response.body) {
      onError('No response body received');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse: ChatResponse | null = null;
    let streamingContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines (Server-Sent Events format)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          // Handle Server-Sent Events format
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              // Streaming complete
              if (finalResponse) {
                onComplete(finalResponse);
              } else if (streamingContent) {
                // Create a fallback response from streaming content
                const fallbackResponse: ChatResponse = {
                  response: {
                    story: {
                      title: 'YMCA Historical Response',
                      narrative: streamingContent,
                    },
                  },
                  responseType: 'streaming',
                  conversationId: '',
                  sessionId: '',
                  language: 'en',
                  processingTime: 0,
                  translationUsed: false,
                  timestamp: new Date().toISOString(),
                };
                onComplete(fallbackResponse);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'chunk') {
                // Streaming text chunk
                const content = parsed.content || '';
                streamingContent += content;
                onChunk(content);
              } else if (parsed.type === 'complete') {
                // Final structured response
                finalResponse = parsed.response;
              } else if (parsed.type === 'error') {
                onError(parsed.error || 'Unknown streaming error');
                return;
              }
            } catch {
              // If not JSON, treat as plain text chunk
              streamingContent += data;
              onChunk(data);
            }
          } else {
            // Handle plain text streaming (fallback)
            streamingContent += line;
            onChunk(line);
          }
        }
      }

      // Process any remaining content in buffer
      if (buffer.trim()) {
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'complete') {
              finalResponse = parsed.response;
            }
          } catch {
            streamingContent += data;
            onChunk(data);
          }
        } else {
          streamingContent += buffer;
          onChunk(buffer);
        }
      }

      // If we have a final response, use it; otherwise create fallback
      if (finalResponse) {
        onComplete(finalResponse);
      } else if (streamingContent) {
        const fallbackResponse: ChatResponse = {
          response: {
            story: {
              title: 'YMCA Historical Response',
              narrative: streamingContent,
            },
          },
          responseType: 'streaming',
          conversationId: '',
          sessionId: '',
          language: 'en',
          processingTime: 0,
          translationUsed: false,
          timestamp: new Date().toISOString(),
        };
        onComplete(fallbackResponse);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Error in streaming chat:', error);
    onError(error instanceof Error ? error.message : 'Streaming error occurred');
  }
};

/**
 * Check if streaming is supported and configured
 */
export const isStreamingSupported = (): boolean => {
  return !!(STREAMING_URL || API_URL);
};

