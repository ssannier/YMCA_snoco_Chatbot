/**
 * TypeScript type definitions for YMCA Chatbot API
 */

// Story response structure from backend
export interface StoryResponse {
  title: string;
  narrative: string;
  timeline?: string;
  locations?: string;
  keyPeople?: string;
  whyItMatters?: string;
}

// Full API response structure
export interface ChatResponse {
  response: {
    story: StoryResponse;
    lessonsAndThemes?: string[];
    modernReflection?: string;
    exploreFurther?: string[];
  };
  responseType: 'structured' | 'narrative' | 'error';
  rawResponse?: string;
  sources?: Source[];
  conversationId: string;
  sessionId: string;
  language: string;
  processingTime: number;
  translationUsed: boolean;
  timestamp: string;
  metadata?: {
    knowledgeBaseUsed: boolean;
    citationsFound: number;
    responseStructured: boolean;
    fallbackUsed: boolean;
  };
}

// Citation/Source structure
export interface Source {
  id: string;
  title: string;
  source: string;
  confidence: number;
  excerpt: string;
  fullText?: string;
}

// Chat request structure
export interface ChatRequest {
  message: string;
  conversationId?: string;
  language?: string;
  sessionId?: string;
  userId?: string;
}

// Message structure for UI
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string | ChatResponse;
  timestamp: Date;
  isStreaming?: boolean;
}

// Conversation state
export interface Conversation {
  id: string;
  sessionId: string;
  messages: Message[];
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

// Error response
export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}
