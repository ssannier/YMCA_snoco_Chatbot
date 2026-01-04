/**
 * API Service Layer for YMCA Chatbot
 *
 * Simplified API service using direct fetch calls.
 * Adapted from crisis-help-chatbot implementation pattern.
 */

import type { ChatRequest, ChatResponse, ApiError } from '../types/api';

const API_URL = process.env.NEXT_PUBLIC_API_ENDPOINT;

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
 * Send a chat message to the backend
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

