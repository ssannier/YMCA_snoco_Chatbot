# YMCA Historical Chatbot - Frontend

A Next.js 16 frontend application for the YMCA Historical Chatbot with real-time streaming responses and AWS integration.

## Tech Stack

- **Framework**: Next.js 16.0.1 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **React**: 19.2.0
- **Backend Integration**: AWS Lambda Function URLs with streaming support

## Architecture

### Directory Structure

```
frontend/
├── app/
│   ├── components/        # Reusable UI components
│   ├── context/          # React Context providers
│   │   └── ChatContext.tsx    # Global chat state management
│   ├── hooks/            # Custom React hooks
│   │   └── useChat.ts         # Chat functionality hook
│   ├── chat/             # Chat page
│   │   └── page-new.tsx       # Main chat interface
│   └── page.tsx          # Welcome/landing page
├── lib/
│   ├── amplify-config.ts # AWS configuration
│   └── api-service.ts    # API client for backend
├── types/
│   └── api.ts            # TypeScript type definitions
└── public/              # Static assets
```

### Key Features

1. **Real-time Streaming**: Uses Lambda Function URLs for native streaming support
2. **State Management**: React Context API for global chat state
3. **TypeScript**: Full type safety across the application
4. **Responsive Design**: Mobile-first approach with Tailwind CSS
5. **AWS Integration**: Seamless connection to backend Lambda functions

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file from the example:

```bash
cp .env.local.example .env.local
```

Update `.env.local` with your AWS deployment outputs:

```env
NEXT_PUBLIC_STREAMING_ENDPOINT=https://your-function-url.lambda-url.us-west-2.on.aws/
NEXT_PUBLIC_AWS_REGION=us-west-2
```

### 3. Get AWS Endpoints

After deploying the backend with AWS CDK, you'll get these outputs:

```bash
cd ../backend
cdk deploy

# Look for this output:
# - StreamingFunctionUrl: Your Lambda Function URL for streaming
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Sending Messages

The chat interface uses the `useChat` hook for message handling:

```typescript
const { sendMessage, isLoading, conversation } = useChat();

// Send a message
await sendMessage("Tell me about YMCA history");
```

### Streaming vs Non-Streaming

- **Streaming** (default): Real-time token-by-token responses
- **Non-streaming**: Wait for complete response

Configure in `.env.local`:

```env
NEXT_PUBLIC_ENABLE_STREAMING=true  # or false
```

### Chat Context

Global state is managed via `ChatContext`:

```typescript
import { useChatContext } from './context/ChatContext';

const {
  conversation,      // Current conversation
  isLoading,        // Loading state
  error,            // Error messages
  addUserMessage,   // Add user message
  clearConversation // Clear chat history
} = useChatContext();
```

## API Integration

### Backend Endpoints

1. **POST /chat** - Non-streaming chat endpoint
2. **Lambda Function URL** - Streaming chat endpoint

### Request Format

```json
{
  "message": "Your question here",
  "conversationId": "optional-id",
  "language": "auto",
  "sessionId": "session-id",
  "userId": "user-id"
}
```

### Response Format

```json
{
  "response": {
    "story": {
      "title": "Historical Event Title",
      "narrative": "Detailed narrative...",
      "timeline": "1918-1920",
      "locations": "United States",
      "keyPeople": "John R. Mott",
      "whyItMatters": "Modern relevance..."
    },
    "lessonsAndThemes": ["Lesson 1", "Lesson 2"],
    "modernReflection": "What this teaches us today...",
    "exploreFurther": ["Related question 1", "Related question 2"]
  },
  "sources": [...],
  "conversationId": "conv-id",
  "language": "en",
  "processingTime": 1234
}
```

## Development Best Practices

### Component Structure

- Use **Server Components** by default (no "use client")
- Add "use client" only when using hooks or browser APIs
- Keep components small and focused
- Use early returns for better readability

### State Management

- Use React Context for global state (conversations, user settings)
- Use local state (useState) for component-specific state
- Keep state as close to where it's used as possible

### Error Handling

```typescript
try {
  await sendMessage(message);
} catch (error) {
  // Error is automatically handled by ChatContext
  // and displayed to the user
}
```

### Styling

- Use Tailwind utility classes
- Follow the design system colors from `claude.md`
- Use arbitrary values for design-specific measurements: `px-[24px]`

## Building for Production

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Add environment variables in Vercel dashboard:
- Settings → Environment Variables
- Add all `NEXT_PUBLIC_*` variables from `.env.local`

### AWS Amplify

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

## Troubleshooting

### Streaming Not Working

1. Check `NEXT_PUBLIC_STREAMING_ENDPOINT` is set correctly
2. Verify Lambda Function URL has CORS enabled
3. Check browser console for network errors

### CORS Errors

Backend Lambda functions are configured with CORS.
If you see CORS errors:

1. Check Lambda Function URL CORS configuration
2. Ensure requests include proper headers

### Type Errors

```bash
# Regenerate types if API changes
npm run type-check
```

## Performance Optimization

- Images use Next.js `<Image>` component for optimization
- Code splitting with dynamic imports for large components
- Streaming reduces perceived latency
- React Server Components for reduced JavaScript bundle

## Contributing

Follow the guidelines in `/CLAUDE.md`:

1. Write clean, readable code
2. Use descriptive variable names
3. Add comments for complex logic
4. Test all navigation flows
5. Ensure responsive behavior

## License

Proprietary - YMCA Historical Chatbot Project
