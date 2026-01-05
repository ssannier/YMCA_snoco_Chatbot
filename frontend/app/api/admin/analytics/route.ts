import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client (will use default credential chain)
// This automatically checks: env vars, ~/.aws/credentials, IAM roles, etc.
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-west-2',
    // No explicit credentials - uses default credential provider chain
  }),
  {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  }
);

const ANALYTICS_TABLE = process.env.NEXT_PUBLIC_ANALYTICS_TABLE_NAME || 'ymca-analytics';
const CONVERSATION_TABLE = process.env.NEXT_PUBLIC_CONVERSATION_TABLE_NAME || 'ymca-conversations';

console.log('Admin Analytics API initialized with tables:', {
  analytics: ANALYTICS_TABLE,
  conversations: CONVERSATION_TABLE,
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-west-2',
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '7d'; // 7d, 30d, 90d

    // Calculate time filter
    const now = Date.now();
    const timeRangeMs = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    }[timeRange] || 7 * 24 * 60 * 60 * 1000;

    const startTime = now - timeRangeMs;

    // Fetch analytics data
    const analyticsCommand = new ScanCommand({
      TableName: ANALYTICS_TABLE,
      FilterExpression: '#ts > :startTime',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':startTime': startTime,
      },
    });

    const analyticsResult = await dynamoClient.send(analyticsCommand);
    const analytics = analyticsResult.Items || [];
    console.log(`Fetched ${analytics.length} analytics items`);

    // Fetch recent conversations
    const conversationsCommand = new ScanCommand({
      TableName: CONVERSATION_TABLE,
      FilterExpression: '#ts > :startTime',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':startTime': startTime,
      },
      Limit: 100,
    });

    const conversationsResult = await dynamoClient.send(conversationsCommand);
    const conversations = conversationsResult.Items || [];
    console.log(`Fetched ${conversations.length} conversation items`);

    // Process analytics
    const stats = {
      totalQueries: analytics.length,
      successRate: analytics.filter(a => a.success).length / analytics.length,
      avgProcessingTime: analytics.reduce((sum, a) => sum + (a.processingTimeMs || 0), 0) / analytics.length,
      avgCitations: analytics.reduce((sum, a) => sum + (a.citationsFound || 0), 0) / analytics.length,
      languageBreakdown: {} as Record<string, number>,
      uniqueUsers: new Set(analytics.map(a => a.userId)).size,
      totalConversations: new Set(analytics.map(a => a.conversationId)).size,
    };

    // Language breakdown
    analytics.forEach(item => {
      const lang = item.language || 'unknown';
      stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
    });

    // Extract trending topics (using simple keyword extraction)
    const queryTexts = conversations.map(c => c.userMessage?.toLowerCase() || '');
    const wordCounts: Record<string, number> = {};

    queryTexts.forEach(text => {
      const words = text.split(/\s+/).filter((w: string) => w.length > 4); // Filter short words
      words.forEach((word: string) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });

    const trendingTopics = Object.entries(wordCounts)
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ topic: word, count }));

    // Usage over time (daily buckets)
    const usageByDay: Record<string, number> = {};
    analytics.forEach(item => {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      usageByDay[date] = (usageByDay[date] || 0) + 1;
    });

    const usageTimeline = Object.entries(usageByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Recent queries (last 10)
    const recentQueries = conversations
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(c => ({
        timestamp: new Date(c.timestamp).toISOString(),
        query: c.userMessage,
        language: c.userLanguage,
        citations: c.citationsCount || 0,
        processingTime: c.processingTimeMs,
      }));

    return NextResponse.json({
      stats,
      trendingTopics,
      usageTimeline,
      recentQueries,
      timeRange,
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
