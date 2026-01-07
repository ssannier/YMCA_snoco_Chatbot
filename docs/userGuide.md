# User Guide

This guide provides step-by-step instructions for using the YMCA AI Chatbot.

---

## Prerequisites

**Please ensure the application is deployed before proceeding.**

See the [Deployment Guide](./deploymentGuide.md) for deployment instructions.

---

## Introduction

The YMCA AI Chatbot is an intelligent conversational assistant that helps users explore YMCA history through natural language conversation. The system uses advanced AI technology to provide historically accurate, contextual responses based on uploaded YMCA documents and archives.

### Key Features
- **Multi-language Support**: Chat in 12 languages including English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, and Russian
- **Streaming Responses**: Real-time token-by-token delivery for immediate feedback
- **Source Citations**: Every response includes citations to original documents with download links
- **Contextual Conversations**: The AI maintains conversation history for coherent, multi-turn dialogues
- **Document Upload**: Admin users can upload new historical documents to expand the knowledge base
- **Analytics Dashboard**: Track usage, popular topics, and conversation metrics

---

## Getting Started

### Step 1: Access the Application

Navigate to the application URL provided after deployment (found in CDK outputs as `AmplifyAppUrl`)

**Example**: `https://main.d1234567890abcd.amplifyapp.com/`

![Welcome Screen](./media/step-1-landing-page.png)

> **Note**: If you see the screenshot placeholder message above, the welcome screen shows:
> - YMCA logo and branding
> - Language selector (top right)
> - Four topic cards for quick navigation:
>   - Early History & Founding
>   - Community Programs
>   - Global Impact
>   - Modern YMCA

When you land on the homepage, you'll see:
- **Topic Cards**: Pre-selected topics to help you start exploring YMCA history
- **Language Selector**: Globe icon in the top-right corner to change languages
- **Navigation**: Chat and Admin buttons to access different features

---

### Step 2: Choose a Language (Optional)

1. Click the **globe icon** in the top-right corner
2. Select your preferred language from the dropdown
3. The interface will update to display in your chosen language
4. The AI will respond to your questions in the same language

**Supported Languages**:
- English
- Español (Spanish)
- Français (French)
- Deutsch (German)
- Italiano (Italian)
- Português (Portuguese)
- 中文 (Chinese)
- 日本語 (Japanese)
- 한국어 (Korean)
- العربية (Arabic)
- हिन्दी (Hindi)
- Русский (Russian)

---

### Step 3: Start a Conversation

You have two options to start:

**Option A: Click a Topic Card**
1. Click one of the four topic cards on the homepage
2. The system will navigate to the chat page
3. A starter question related to that topic will be pre-filled
4. Click "Send" or press Enter to submit

**Option B: Navigate to Chat**
1. Click the "Chat" button in the navigation
2. Type your question in the message box
3. Click "Send" or press Enter

**Example Questions**:
- "What was the YMCA's role in World War II?"
- "Tell me about YMCA youth programs in the 1900s"
- "How did the YMCA impact community development?"
- "What programs does the YMCA offer for families today?"

---

### Step 4: View the Response

After submitting your question:

1. **Streaming Response**: You'll see the AI's response appear in real-time, word by word
2. **Structured Format**: The response includes:
   - **Story**: Main narrative with title, historical context, timeline, locations, and key people
   - **Why It Matters**: Explanation of the significance
   - **Lessons & Themes**: Key takeaways from the historical information
   - **Modern Reflection**: How this history relates to today
   - **Cited Sources**: Documents used to generate the response (with download links)
   - **Explore Further**: Suggested follow-up questions

3. **Source Citations**: Click on source titles to download the original documents (valid for 5 minutes)

**Response Structure Example**:
```
Story
━━━━━━━━━━━━━━━━━━━━━
YMCA's Service During World War II
The YMCA played a vital role in supporting military personnel...

Timeline: 1941-1945
Locations: Military bases worldwide, USO centers
Key People: YMCA volunteers, military chaplains

Why It Matters
━━━━━━━━━━━━━━━━━━━━━
The YMCA's wartime service established its role as a community anchor...

Lessons & Themes
━━━━━━━━━━━━━━━━━━━━━
• Community resilience during wartime
• Supporting military families
• Global humanitarian outreach

Sources
━━━━━━━━━━━━━━━━━━━━━
[1] YMCA_WWII_History.pdf (Download)
"The YMCA operated hundreds of centers near military bases..."

Explore Further
━━━━━━━━━━━━━━━━━━━━━
• What programs did the YMCA offer at USO centers?
• How did the YMCA support families on the home front?
```

---

### Step 5: Continue the Conversation

The chatbot maintains conversation context, so you can ask follow-up questions:

1. Type a follow-up question or click one of the "Explore Further" suggestions
2. The AI will reference previous context in its response
3. Continue the conversation naturally as you would with a knowledgeable historian

**Example Conversation Flow**:
- **You**: "Tell me about the YMCA's founding"
- **AI**: [Provides history of YMCA founding in London, 1844]
- **You**: "How did it expand to the United States?"
- **AI**: [Explains YMCA's arrival in America, referencing the previous context]

---

## Common Use Cases

### Use Case 1: Research YMCA History

**Goal**: Learn about a specific historical period or event

**Steps:**
1. Navigate to the chat page
2. Ask a specific historical question (e.g., "What was the YMCA doing in the 1920s?")
3. Review the response and cited sources
4. Download source documents for deeper research
5. Ask follow-up questions to explore specific aspects
6. Use suggested "Explore Further" questions for related topics

**Tips**:
- Be specific about time periods, locations, or events
- Ask about specific programs, people, or initiatives
- Request comparisons across different eras

---

### Use Case 2: Multi-Language Access

**Goal**: Access YMCA history in your native language

**Steps:**
1. Click the globe icon and select your language
2. Ask questions in your native language
3. Receive responses translated to your language
4. All interface elements will be in your selected language
5. Source documents remain in their original language (usually English)

**Example**:
- **Spanish User**: "¿Cuál fue el papel de la YMCA en la educación juvenil?"
- **AI Response**: [Provides Spanish translation of historical information about YMCA youth education]

---

### Use Case 3: Teaching and Education

**Goal**: Use the chatbot to teach students about YMCA history

**Steps:**
1. Prepare a list of questions aligned with your lesson plan
2. Start a conversation with an overview question
3. Use the "Lessons & Themes" section to highlight key learning points
4. Share source document links with students for primary source analysis
5. Use "Explore Further" questions to encourage student inquiry

---

## Admin Features

### Accessing the Admin Dashboard

1. Navigate to `/admin` on your deployed application
2. **Login**:
   - Email: Your admin email (set during deployment)
   - Password: Your admin password (saved in `backend/.env`)
3. Click "Sign In"

### Uploading Documents

**Purpose**: Add new historical documents to expand the knowledge base

**Steps:**
1. Log in to the admin dashboard
2. Navigate to the "Upload Documents" section
3. Click "Choose File" or drag and drop a document
4. Supported formats: PDF, PNG, JPG, JPEG, TIFF
5. Click "Upload"
6. Wait for processing (may take a few minutes for large documents)
7. The document will be available for the chatbot to reference

**Document Processing Timeline**:
- **Immediate**: File uploaded to S3
- **30 seconds - 2 minutes**: Textract begins processing
- **2-10 minutes**: Text extraction completes (varies by document size)
- **10-15 minutes**: Document indexed in knowledge base
- **Ready**: Chatbot can now reference the document

### Viewing Analytics

**Purpose**: Track chatbot usage and popular topics

**Steps:**
1. Log in to the admin dashboard
2. Navigate to the "Analytics" section
3. View metrics:
   - **Total Conversations**: Number of unique conversations
   - **Total Queries**: Number of questions asked
   - **Popular Topics**: Most frequently asked about subjects
   - **Language Distribution**: Usage by language
   - **Average Response Time**: Performance metrics
   - **Citation Usage**: Most-referenced documents

**Analytics Refresh**: Data updates in real-time as users interact with the chatbot

---

## Tips and Best Practices

- **Tip 1**: Be specific with your questions for more focused, accurate responses
- **Tip 2**: Use the suggested "Explore Further" questions to discover related topics
- **Tip 3**: Click source citations to verify information in original documents
- **Tip 4**: Start broad, then narrow down with follow-up questions
- **Tip 5**: Change languages mid-conversation if needed - the conversation context is preserved
- **Tip 6**: For complex topics, break your question into smaller parts across multiple messages
- **Tip 7**: Use the streaming feature to see responses as they're generated
- **Tip 8**: Admin: Upload diverse document types (meeting minutes, newsletters, reports) for richer responses

---

## Frequently Asked Questions (FAQ)

### Q: Why doesn't the chatbot know about a specific topic?
**A:** The chatbot can only answer questions based on documents uploaded to the knowledge base. If information is missing:
- Check if relevant documents have been uploaded
- Ask an admin to upload historical documents covering that topic
- Wait 10-15 minutes after upload for indexing to complete

### Q: Can I download the source documents cited in responses?
**A:** Yes! Click the source title in the "Sources" section. The download link is valid for 5 minutes. If expired, ask the question again to get a fresh link.

### Q: How accurate are the responses?
**A:** Responses are generated from uploaded historical documents using Amazon Bedrock AI. The system provides citations so you can verify information. Accuracy depends on the quality and completeness of the uploaded documents.

### Q: Can I use this on mobile devices?
**A:** Yes, the application is responsive and works on smartphones and tablets. The interface adapts to different screen sizes.

### Q: How do I change the language mid-conversation?
**A:** Click the globe icon and select a new language. The chatbot will respond in the new language while maintaining conversation context.

### Q: Why is the response slow?
**A:** Processing time varies based on:
- Document knowledge base size
- Complexity of the question
- Translation requirements (multi-language queries take slightly longer)
- AWS service availability
Use the streaming endpoint for faster perceived response time.

### Q: Can multiple people use the chatbot simultaneously?
**A:** Yes, the system is designed for concurrent users. Each conversation is independent and tracked separately.

### Q: How long is conversation history maintained?
**A:** Conversation history is stored in DynamoDB and persists indefinitely. Use the conversation ID to resume previous conversations.

---

## Troubleshooting

### Issue: The chatbot says "I don't have information about that"
**Solution**:
- The topic may not be covered in uploaded documents
- Ask the question differently or more specifically
- Check with an admin about uploading relevant documents
- Try broader questions first, then narrow down

### Issue: Source document links don't work
**Solution**:
- Pre-signed URLs expire after 5 minutes
- Ask the question again to get fresh download links
- Alternatively, ask an admin for direct access to the document

### Issue: Language translation seems incorrect
**Solution**:
- Try rephrasing your question more simply
- Switch to English for the most accurate responses (the knowledge base is primarily in English)
- Report significant translation issues for improvement

### Issue: Cannot access admin dashboard
**Solution**:
- Verify you're using the correct admin email and password (check `backend/.env`)
- Ensure you've completed the deployment and user creation steps
- Try resetting your password through the Cognito console

### Issue: Uploaded document not showing in responses
**Solution**:
- Wait 10-15 minutes for document processing and indexing
- Check Step Functions in AWS Console for processing status
- Verify the document was uploaded successfully (check S3 bucket)
- Ensure the document format is supported (PDF, PNG, JPG, TIFF)

---

## Getting Help

If you encounter issues not covered in this guide:

- **Technical Issues**: Check CloudWatch Logs in AWS Console
- **Document Upload Problems**: Verify Step Functions execution status
- **Feature Requests**: Open an issue on GitHub
- **Deployment Help**: See the [Deployment Guide](./deploymentGuide.md)
- **API Integration**: See the [API Documentation](./APIDoc.md)

---

## Next Steps

- Explore the [API Documentation](./APIDoc.md) for programmatic access
- Check the [Architecture Deep Dive](./architectureDeepDive.md) to understand how the system works
- See the [Modification Guide](./modificationGuide.md) if you want to customize the application
- Review the [Streaming Integration Guide](./streamingIntegration.md) for advanced streaming configuration
