# Streaming Integration Guide

This guide explains how to integrate the frontend with the backend streaming endpoint using Lambda Function URLs.

## Backend Endpoint

The CDK stack creates a Lambda Function URL with native streaming support:

### Lambda Function URL
- **Endpoint**: Available in CDK output as `StreamingFunctionUrl`
- **Format**: `https://your-function-url.lambda-url.region.on.aws/`
- **Invoke Mode**: RESPONSE_STREAM (native Lambda streaming)
- **Use for**: `NEXT_PUBLIC_STREAMING_ENDPOINT`

### Advantages
- ✅ **Native streaming support** - No API Gateway overhead
- ✅ **15-minute timeout** - Handles long responses
- ✅ **Lower latency** - Direct Lambda invocation
- ✅ **Cost-effective** - No API Gateway charges
- ✅ **Better performance** - Optimized for streaming workloads

## Frontend Configuration

### Environment Variables

> **Note**: For production deployment via Amplify, these environment variables are automatically injected by CDK during build. You only need `.env.local` for local development.

Create `frontend/.env.local` with:

```bash
# Streaming endpoint (Lambda Function URL)
NEXT_PUBLIC_STREAMING_ENDPOINT=https://your-function-url.lambda-url.us-west-2.on.aws/

# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-west-2
NEXT_PUBLIC_USER_POOL_ID=us-west-2_XXXXXXXXX
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-client-id
NEXT_PUBLIC_IDENTITY_POOL_ID=us-west-2:xxxx-xxxx-xxxx-xxxx
NEXT_PUBLIC_DOCUMENTS_BUCKET=ymca-documents-xxxx-region
```

### Getting the URL from CDK Deployment

After deploying the backend stack, you'll see output like:

```
YmcaAiStack.StreamingFunctionUrl = https://xyz789.lambda-url.us-west-2.on.aws/
```

Use:
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

### 3. Error Handling
- If streaming fails, error is displayed to user with retry option
- Graceful error handling maintains user experience
- Connection issues are handled automatically

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
   - Ensure Lambda Function URL has CORS configured in CDK stack
   - Check that allowed origins include your frontend domain
   - Verify allowed methods include POST

2. **Streaming Not Working**
   - Verify `NEXT_PUBLIC_STREAMING_ENDPOINT` is set correctly
   - Check browser network tab for streaming response
   - Ensure response content-type is `text/event-stream`
   - Check for SSE format: lines starting with `data: `

3. **Timeout Issues**
   - Lambda Function URL has 15-minute timeout (sufficient for all responses)
   - If timeout occurs, check Lambda execution logs in CloudWatch

### Debug Steps

1. Check browser console for errors
2. Verify environment variables are loaded (`console.log(process.env.NEXT_PUBLIC_STREAMING_ENDPOINT)`)
3. Test Lambda Function URL directly with curl
4. Check CDK deployment outputs for correct URL
5. Verify Lambda function permissions in IAM
6. Check CloudWatch Logs for Lambda execution errors

## Performance Considerations

### Streaming Benefits
- ✅ **Immediate response feedback** - Users see text as it's generated
- ✅ **Better UX for long responses** - No waiting for complete response
- ✅ **Reduced perceived latency** - Engagement starts immediately
- ✅ **Token-by-token delivery** - Smooth typing effect

### Architecture Benefits of Lambda Function URL
- **Direct invocation** - No API Gateway intermediary
- **Native streaming** - Built-in RESPONSE_STREAM support
- **Simpler stack** - Fewer AWS services to manage
- **Lower cost** - No API Gateway charges (~$3.50/million requests)

## Security Notes

- Lambda Function URL requires proper CORS configuration (configured in CDK)
- Currently public endpoint (no authentication required for chat)
- Can be secured with:
  - AWS IAM authorization (`AWS_IAM` auth type)
  - Custom Lambda authorizer
  - AWS WAF for IP-based rate limiting
- Consider implementing rate limiting for production use:
  - Lambda reserved concurrency
  - Application-level rate limiting by session/IP
  - AWS WAF rate-based rules