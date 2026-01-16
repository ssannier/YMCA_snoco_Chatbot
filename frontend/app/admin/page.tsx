'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import FileUpload from '../components/FileUpload';
import '@aws-amplify/ui-react/styles.css';

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '',
      identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID || '',
    }
  }
});

interface AnalyticsData {
  stats: {
    totalQueries: number;
    successRate: number;
    avgProcessingTime: number;
    avgCitations: number;
    languageBreakdown: Record<string, number>;
    uniqueUsers: number;
    totalConversations: number;
  };
  topicDistribution: Array<{ category: string; count: number; percentage: number }>;
  usageTimeline: Array<{ date: string; count: number }>;
  recentQueries: Array<{
    timestamp: string;
    query: string;
    language: string;
    citations: number;
    processingTime: number;
    category?: string;
  }>;
  timeRange: string;
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (range: string) => {
    try {
      setLoading(true);
      setError(null);

      // Get Cognito credentials
      const session = await fetchAuthSession();
      const credentials = session.credentials;

      if (!credentials) {
        throw new Error('Not authenticated');
      }

      // Initialize DynamoDB client with Cognito credentials
      const dynamoClient = DynamoDBDocumentClient.from(
        new DynamoDBClient({
          region: process.env.NEXT_PUBLIC_REGION || 'us-west-2',
          credentials: credentials,
        }),
        { marshallOptions: { removeUndefinedValues: true } }
      );

      const ANALYTICS_TABLE = process.env.NEXT_PUBLIC_ANALYTICS_TABLE_NAME || 'ymca-analytics';
      const CONVERSATION_TABLE = process.env.NEXT_PUBLIC_CONVERSATION_TABLE_NAME || 'ymca-conversations';

      const now = Date.now();
      const timeRangeMs = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
      }[range] || 7 * 24 * 60 * 60 * 1000;

      const startTime = now - timeRangeMs;

      // Fetch analytics and conversations in parallel
      const [analyticsResult, conversationsResult] = await Promise.all([
        dynamoClient.send(new ScanCommand({
          TableName: ANALYTICS_TABLE,
          FilterExpression: '#ts > :startTime',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
          ExpressionAttributeValues: { ':startTime': startTime },
        })),
        dynamoClient.send(new ScanCommand({
          TableName: CONVERSATION_TABLE,
          FilterExpression: '#ts > :startTime',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
          ExpressionAttributeValues: { ':startTime': startTime },
          Limit: 100,
        })),
      ]);

      const analytics = analyticsResult.Items || [];
      const conversations = conversationsResult.Items || [];

      // Process analytics
      const stats = {
        totalQueries: analytics.length,
        successRate: analytics.length > 0 ? analytics.filter((a) => a.success).length / analytics.length : 0,
        avgProcessingTime: analytics.length > 0 ? analytics.reduce((sum: number, a) => sum + (a.processingTimeMs || 0), 0) / analytics.length : 0,
        avgCitations: analytics.length > 0 ? analytics.reduce((sum: number, a) => sum + (a.citationsFound || 0), 0) / analytics.length : 0,
        languageBreakdown: {} as Record<string, number>,
        uniqueUsers: new Set(analytics.map((a) => a.userId)).size,
        totalConversations: new Set(analytics.map((a) => a.conversationId)).size,
      };

      analytics.forEach((item) => {
        const lang = item.language || 'unknown';
        stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
      });

      // Aggregate topic distribution by category (MULTI-CATEGORY SUPPORT)
      const categoryCounts: Record<string, number> = {};
      analytics.forEach((item) => {
        const categoryString = item.category || 'General/Other Questions';
        // Split by " | " to handle multiple categories per query
        const categories = categoryString.split(' | ').map((cat: string) => cat.trim());

        categories.forEach((category: string) => {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
      });

      const totalCategorized = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
      const topicDistribution = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([category, count]) => ({
          category,
          count,
          percentage: totalCategorized > 0 ? (count / totalCategorized) * 100 : 0
        }));

      // Usage over time
      const usageByDay: Record<string, number> = {};
      analytics.forEach((item) => {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        usageByDay[date] = (usageByDay[date] || 0) + 1;
      });

      const usageTimeline = Object.entries(usageByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      // Recent queries (match with analytics for category info)
      const recentQueries = conversations
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
        .map((c) => {
          // Try to find matching analytics entry for category
          const matchingAnalytics = analytics.find(
            (a) => a.conversationId === c.conversationId &&
                   Math.abs(a.timestamp - c.timestamp) < 1000
          );
          return {
            timestamp: new Date(c.timestamp).toISOString(),
            query: c.userMessage,
            language: c.userLanguage,
            citations: c.citationsCount || 0,
            processingTime: c.processingTimeMs,
            category: matchingAnalytics?.category || undefined,
          };
        });

      setData({ stats, topicDistribution, usageTimeline, recentQueries, timeRange: range });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [timeRange]);

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  return (
    <Authenticator>
      {({ signOut }) => (
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-[24px] py-[16px] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-[#0089d0] hover:text-[#0077b8] transition-colors">
                  ← Back to Chat
                </Link>
                <h1 className="text-2xl font-bold text-[#231f20]">Admin Dashboard</h1>
              </div>

              <div className="flex items-center gap-4">
                {/* Time Range Selector */}
                <div className="flex gap-2">
                  {['7d', '30d', '90d'].map((range) => (
                    <button
                      key={range}
                      onClick={() => handleTimeRangeChange(range)}
                      className={`px-4 py-2 rounded-[100px] transition-colors ${timeRange === range
                        ? 'bg-[#0089d0] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {range === '7d' ? 'Last 7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={signOut}
                  className="text-sm text-red-600 hover:text-red-800 font-medium px-4 py-2 hover:bg-red-50 rounded-full transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-[24px] py-[24px]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0089d0]"></div>
                  <p className="mt-4 text-gray-600">Loading analytics...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-white rounded-[12px] shadow-lg p-8 max-w-md mx-auto mt-12 text-center">
                <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Analytics</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={() => fetchAnalytics(timeRange)}
                  className="bg-[#0089d0] text-white px-6 py-2 rounded-[100px] hover:bg-[#0077b8] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : data ? (
              <>
                {/* File Upload Section */}
                <div className="mb-8">
                  <FileUpload apiEndpoint={process.env.NEXT_PUBLIC_API_ENDPOINT?.replace('/chat', '') || ''} />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard
                    title="Total Queries"
                    value={data.stats.totalQueries.toLocaleString()}
                    color="bg-[#0089d0]"
                  />
                  <StatCard
                    title="Success Rate"
                    value={`${(data.stats.successRate * 100).toFixed(1)}%`}
                    color="bg-[#01a490]"
                  />
                  <StatCard
                    title="Unique Users"
                    value={data.stats.uniqueUsers.toLocaleString()}
                    color="bg-[#f47920]"
                  />
                  <StatCard
                    title="Avg Citations"
                    value={data.stats.avgCitations.toFixed(1)}
                    color="bg-[#92278f]"
                  />
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <MetricCard
                    title="Performance"
                    metrics={[
                      { label: 'Avg Processing Time', value: `${data.stats.avgProcessingTime.toFixed(0)}ms` },
                      { label: 'Total Conversations', value: data.stats.totalConversations.toLocaleString() },
                    ]}
                  />
                  <MetricCard
                    title="Language Distribution"
                    metrics={Object.entries(data.stats.languageBreakdown).map(([lang, count]) => ({
                      label: lang.toUpperCase(),
                      value: count.toString(),
                    }))}
                  />
                </div>

                {/* Topic Distribution */}
                <div className="bg-white rounded-[12px] shadow-sm border border-[#d1d5dc] p-6 mb-8">
                  <h2 className="text-xl font-bold text-[#231f20] mb-4">Topic Distribution</h2>
                  <div className="space-y-4">
                    {data.topicDistribution.map((topic, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-[#231f20]">{topic.category}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-[#636466]">{topic.count} queries</span>
                            <span className="text-sm font-medium text-[#0089d0]">
                              {topic.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className="bg-[#0089d0] h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${topic.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {data.topicDistribution.length === 0 && (
                    <p className="text-center text-[#636466] py-4">
                      No topic data available yet. Categories will appear as users interact with the chatbot.
                    </p>
                  )}
                </div>

                {/* Recent Queries */}
                <div className="bg-white rounded-[12px] shadow-sm border border-[#d1d5dc] p-6">
                  <h2 className="text-xl font-bold text-[#231f20] mb-4">Recent Queries</h2>
                  <div className="space-y-4">
                    {data.recentQueries.map((query, index) => {
                      // Parse multiple categories if they exist
                      const categories = query.category
                        ? query.category.split(' | ').map(cat => cat.trim())
                        : [];

                      return (
                        <div
                          key={index}
                          className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-4">
                              <p className="text-[#231f20] font-medium mb-2">{query.query}</p>
                              {categories.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {categories.map((cat, catIndex) => (
                                    <span
                                      key={catIndex}
                                      className="inline-block bg-[#0089d0] bg-opacity-10 text-[#0089d0] text-xs px-2 py-1 rounded-full"
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-[#636466] whitespace-nowrap">
                              {new Date(query.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-[#636466]">
                            <span>Language: {query.language.toUpperCase()}</span>
                            <span>Citations: {query.citations}</span>
                            <span>Time: {query.processingTime}ms</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </main>
        </div>
      )}
    </Authenticator>
  );
}

// Stat Card Component
const StatCard = ({ title, value, color }: { title: string; value: string; color: string }) => (
  <div className={`${color} text-white rounded-[12px] p-6 shadow-sm`}>
    <p className="text-sm opacity-90 mb-2">{title}</p>
    <p className="text-3xl font-bold">{value}</p>
  </div>
);

// Metric Card Component
const MetricCard = ({ title, metrics }: { title: string; metrics: Array<{ label: string; value: string }> }) => (
  <div className="bg-white rounded-[12px] shadow-sm border border-[#d1d5dc] p-6">
    <h3 className="text-lg font-bold text-[#231f20] mb-4">{title}</h3>
    <div className="space-y-3">
      {metrics.map((metric, index) => (
        <div key={index} className="flex justify-between items-center">
          <span className="text-[#636466]">{metric.label}</span>
          <span className="text-[#231f20] font-medium">{metric.value}</span>
        </div>
      ))}
    </div>
  </div>
);
