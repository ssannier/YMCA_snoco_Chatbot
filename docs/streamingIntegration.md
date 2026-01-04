# Streaming Integration Guide

This guide explains how to integrate the frontend with the backend streaming endpoints.

## Backend Endpoints

The CDK stack creates two streaming options:

### 1. Lambda Function URL (Recommended)
- **Endpoint**: Available in CDK output as `StreamingFunctionUrl`
- **Format**: `https://your-function-url.lambda-url.region.on.aws/`
- **Advantages**: Native streaming support, better performance
- **Use for**: `NEXT_PUBLIC_STREAMING_ENDPOINT`

### 2. API Gateway Streaming
- **Endpoint**: `${API_GATEWAY_URL}/chat-stream`
- **Format**: `https://your-api-id.execute-api.region.amazonaws.com/prod/chat-stream`
- **Advantages**: Integrated with existing API
- **Limitations**: May have timeout constraints

## Frontend Configuration

### Environment Variables

Create `frontend/.env.local` with:

```bash
# Regular API endpoint
NEXT_PUBLIC_API_ENDPOINT=https://your-api-id.execute-api.us-west-2.amazonaws.com/prod

# Streaming endpoint (Lambda Function URL - recommended)
NEXT_PUBLIC_STREAMING_ENDPOINT=https://your-function-url.lambda-url.us-west-2.on.aws/
```

### Getting the URLs from CDK Deployment

After deploying the backend stack, you'll see outputs like:

```
YmcaAiStack.ApiEndpoint = https://abc123.execute-api.us-west-2.amazonaws.com/prod/
YmcaAiStack.StreamingFunctionUrl = https://xyz789.lambda-url.us-west-2.on.aws/
YmcaAiStack.ChatStreamingEndpoint = https://abc123.execute-api.us-west-2.amazonaws.com/prod/chat-stream
```

Use:
- `ApiEndpoint` for `NEXT_PUBLIC_API_ENDPOINT`
- `StreamingFunctionUrl` for `NEXT_PUBLIC_STREAMING_ENDPOINT`

## How Streaming Works

### 1. Frontend Flow
1. User sends message
2. `useChat` hook calls `sendStreamingChatMessage`
3. Streaming response is processed chunk by chunk
4. UI updates in real-time as chunks arrive
5. Final structured response replaces streaming content

### 2. Backend Flow
1. Lambda receives request
2. Calls Bedrock Knowledge Base for retrieval
3. Streams response using Server-Sent Events format
4. Sends final structured response

### 3. Fallback Behavior
- If streaming endpoint is not configured, falls back to regular API
- If streaming fails, automatically retries with non-streaming endpoint
- Error handling maintains user experience

## Testing the Integration

### 1. Deploy Backend
```bash
cd backend
npm install
cdk deploy
```

### 2. Configure Frontend
```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with your CDK outputs
```

### 3. Test Streaming
```bash
cd frontend
npm run dev
```

Navigate to the chat interface and send a message. You should see:
- Real-time streaming text appearing
- Smooth typing effect
- Final structured response with sources

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure Lambda Function URL has CORS configured
   - Check API Gateway CORS settings

2. **Streaming Not Working**
   - Verify `NEXT_PUBLIC_STREAMING_ENDPOINT` is set
   - Check browser network tab for streaming response
   - Fallback to regular API should work

3. **Timeout Issues**
   - Lambda Function URL: 15-minute timeout
   - API Gateway: 30-second timeout (use Function URL for long responses)

### Debug Steps

1. Check browser console for errors
2. Verify environment variables are loaded
3. Test regular API endpoint first
4. Check CDK deployment outputs
5. Verify Lambda function permissions

## Performance Considerations

### Streaming Benefits
- Immediate response feedback
- Better user experience for long responses
- Reduced perceived latency

### When to Use Each Endpoint
- **Streaming**: Interactive chat, long responses
- **Regular API**: Batch processing, simple queries

## Security Notes

- Both endpoints require proper CORS configuration
- Lambda Function URL is public but can be secured with auth
- API Gateway provides additional security layers
- Consider rate limiting for production use