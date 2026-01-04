"use client";

/**
 * Chat Page - YMCA Historical Chatbot
 *
 * This is the main chat interface with streaming support and real-time responses.
 * Follows Next.js 16 and React 19 best practices.
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useChat } from '../hooks/useChat';
import { cn } from '../../lib/utils';
import type { ChatResponse, Message } from '../../types/api';
import '../../lib/i18n';

// Icon Components imported from lib/icons
import {
  SendIcon,
  StoryIcon,
  CalendarIcon,
  LocationIcon,
  KeyPeopleIcon,
  WhyItMatteredIcon,
  LessonsIcon,
  MomentTeachesIcon,
  SourcesIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  LightbulbIcon
} from '../../lib/icons';

// Logo image
const imgImage3 = "http://localhost:3845/assets/d005aa1de1f0be0acb65a4ca67a096300f4ad73c.png";

/**
 * Message Bubble Component
 */
interface MessageBubbleProps {
  message: Message;
  onSuggestionClick?: (suggestion: string) => void;
}

const MessageBubble = ({ message, onSuggestionClick }: MessageBubbleProps) => {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Typing effect for streaming messages
  useEffect(() => {
    // Safety check for message content
    const response = message.content as ChatResponse;
    const narrative = response?.response?.story?.narrative || '';

    // If not streaming or not assistant or fully displayed, ensure full text is shown
    if (!message.isStreaming || message.role !== 'assistant') {
      if (displayedText !== narrative) {
        setDisplayedText(narrative);
      }
      setIsTyping(false);
      return;
    }

    // If message is streaming:
    // Check if we are caught up
    if (displayedText === narrative) {
      setIsTyping(false);
      return;
    }

    // We are behind. Type the next character.
    setIsTyping(true);
    const delay = Math.random() * 20 + 10; // slightly faster typing

    // Use a timeout to schedule the next character update
    // This breaks the synchronous loop and prevents "Maximum update depth exceeded"
    const timeoutId = setTimeout(() => {
      setDisplayedText(narrative.substring(0, displayedText.length + 1));
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [message.content, message.isStreaming, displayedText, message.role]);

  if (message.role === 'user') {
    return (
      <div className={cn("content-stretch flex flex-col items-end relative shrink-0 w-full")}>
        <div className={cn("bg-[#0089d0] content-stretch flex flex-col items-start p-[24px] relative rounded-[12px] shrink-0 max-w-[672px]")}>
          <p className={cn("font-normal leading-[28px] not-italic relative shrink-0 text-[18px] text-white w-full")}>
            {typeof message.content === 'string' ? message.content : ''}
          </p>
        </div>
      </div>
    );
  }

  // Assistant message
  const response = message.content as ChatResponse;

  // For streaming messages, show the typing effect
  if (message.isStreaming) {
    return (
      <div className="bg-white border border-[#d1d5dc] border-solid content-stretch flex flex-col items-start overflow-hidden relative rounded-[12px] shrink-0 w-full max-w-[976px]">
        <div className="content-stretch flex flex-col gap-[40px] items-start p-[40px] relative shrink-0 w-full break-words overflow-wrap-anywhere">
          <div className={cn("content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full")}>
            {/* STORY Badge */}
            <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0")}>
              <div className={cn("relative shrink-0 size-[16px] text-[#0089d0]")}>
                <StoryIcon className="w-full h-full" />
              </div>
              <p className={cn("font-cachet font-bold leading-[14px] not-italic relative shrink-0 text-[#0089d0] text-[14px] tracking-[0.7px] uppercase")}>
                STORY
              </p>
            </div>

            <div className={cn("font-verdana font-normal leading-[28px] not-italic relative shrink-0 text-[#231f20] text-[18px] w-full prose prose-lg max-w-none")}>
              <ReactMarkdown>{displayedText}</ReactMarkdown>
              {isTyping && (
                <span className="inline-block w-2 h-5 bg-[#0089d0] ml-1 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Structured response
  if (response.response) {
    const { story, lessonsAndThemes, modernReflection, exploreFurther } = response.response;

    return (
      <div className="bg-white border border-[#d1d5dc] border-solid content-stretch flex flex-col items-start overflow-hidden relative rounded-[12px] shrink-0 w-full max-w-[976px]">
        <div className="content-stretch flex flex-col gap-[40px] items-start p-[40px] relative shrink-0 w-full break-words overflow-wrap-anywhere">

          {/* Story Section */}
          {story && (
            <div className={cn("content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full")}>
              {/* STORY Badge */}
              <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0")}>
                <div className={cn("relative shrink-0 size-[16px] text-[#0089d0]")}>
                  <StoryIcon className="w-full h-full" />
                </div>
                <p className={cn("font-cachet font-bold leading-[14px] not-italic relative shrink-0 text-[#0089d0] text-[14px] tracking-[0.7px] uppercase")}>
                  STORY
                </p>
              </div>

              <div className={cn("font-verdana font-normal leading-[28px] not-italic relative shrink-0 text-[#231f20] text-[18px] w-full prose prose-lg max-w-none")}>
                <ReactMarkdown>{story.narrative}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Metadata Section */}
          {(story?.timeline || story?.locations || story?.keyPeople) && (
            <div className={cn("border-[#0089d0] border-[0px_0px_0px_4px] border-solid content-stretch flex flex-col items-start p-[24px] relative rounded-br-[12px] rounded-tr-[12px] shrink-0 w-full")} style={{ backgroundImage: "linear-gradient(165.964deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 137, 208, 0.05) 100%)" }}>
              <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full">
                {story.timeline && (
                  <div className="content-stretch flex gap-[8px] items-start relative shrink-0">
                    <div className="relative shrink-0 size-[16px] text-[#f47920] mt-[2px]">
                      <CalendarIcon className="w-full h-full" />
                    </div>
                    <div className="content-stretch flex flex-col items-start relative shrink-0">
                      <p className="relative shrink-0 text-[#636466] text-[14px] font-medium uppercase tracking-wide">Timeline</p>
                      <p className="relative shrink-0 text-[#231f20] text-[16px]">{story.timeline}</p>
                    </div>
                  </div>
                )}
                {story.locations && (
                  <div className="content-stretch flex gap-[8px] items-start relative shrink-0">
                    <div className="relative shrink-0 size-[16px] text-[#01a490] mt-[2px]">
                      <LocationIcon className="w-full h-full" />
                    </div>
                    <div className="content-stretch flex flex-col items-start relative shrink-0">
                      <p className="relative shrink-0 text-[#636466] text-[14px] font-medium uppercase tracking-wide">Locations</p>
                      <p className="relative shrink-0 text-[#231f20] text-[16px]">{story.locations}</p>
                    </div>
                  </div>
                )}
                {story.keyPeople && (
                  <div className="content-stretch flex gap-[8px] items-start relative shrink-0">
                    <div className="relative shrink-0 size-[16px] text-[#92278f] mt-[2px]">
                      <KeyPeopleIcon className="w-full h-full" />
                    </div>
                    <div className="content-stretch flex flex-col items-start relative shrink-0">
                      <p className="relative shrink-0 text-[#636466] text-[14px] font-medium uppercase tracking-wide">Key People</p>
                      <p className="relative shrink-0 text-[#231f20] text-[16px]">{story.keyPeople}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Why It Mattered */}
          {story?.whyItMatters && (
            <div className={cn("content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full")}>
              <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0")}>
                <div className={cn("relative shrink-0 size-[16px] text-[#00B2A9]")}>
                  <WhyItMatteredIcon className="w-full h-full" />
                </div>
                <p className={cn("font-cachet font-bold leading-[14px] not-italic relative shrink-0 text-[#00B2A9] text-[14px] tracking-[0.7px] uppercase")}>
                  Why It Mattered
                </p>
              </div>
              <div className={cn("font-verdana font-normal leading-[28px] not-italic text-[#231f20] text-[18px] prose prose-lg max-w-none")}>
                <ReactMarkdown>{story.whyItMatters}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Lessons & Themes */}
          {lessonsAndThemes && lessonsAndThemes.length > 0 && (
            <div className={cn("content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full")}>
              <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0")}>
                <div className={cn("relative shrink-0 size-[16px] text-[#F47920]")}>
                  <LessonsIcon className="w-full h-full" />
                </div>
                <p className={cn("font-cachet font-bold leading-[14px] not-italic relative shrink-0 text-[#F47920] text-[14px] tracking-[0.7px] uppercase")}>
                  Lessons & Themes
                </p>
              </div>
              <div className={cn("content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full")}>
                {lessonsAndThemes.map((lesson, index) => (
                  <div key={index} className={cn("content-stretch flex gap-[8px] items-start relative shrink-0 w-full")}>
                    <div className={cn("content-stretch flex items-center px-0 py-[8px] relative shrink-0")}>
                      <div className={cn("bg-[#F47920] rounded-[100px] shrink-0 size-[8px]")} />
                    </div>
                    <p className={cn("font-verdana font-normal leading-[28px] not-italic text-[#231f20] text-[18px]")}>
                      {lesson}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modern Reflection */}
          {modernReflection && (
            <div className={cn("border-[#92278F] border-[0px_0px_0px_4px] border-solid content-stretch flex flex-col items-start p-[24px] relative rounded-br-[12px] rounded-tr-[12px] shrink-0 w-full")} style={{ backgroundImage: "linear-gradient(167.174deg, rgba(255, 255, 255, 0.05) 0%, rgba(146, 39, 143, 0.05) 100%)" }}>
              <div className={cn("content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full")}>
                <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0")}>
                  <div className={cn("relative shrink-0 size-[24px] text-[#92278F]")}>
                    <MomentTeachesIcon className="w-full h-full" />
                  </div>
                  <p className={cn("font-cachet font-medium leading-[18px] not-italic relative shrink-0 text-[#92278F] text-[18px]")}>
                    What this moment teaches us today
                  </p>
                </div>
                <div className={cn("font-verdana font-normal leading-[28px] not-italic relative shrink-0 text-[#231f20] text-[18px] prose prose-lg max-w-none")}>
                  <ReactMarkdown>{modernReflection}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Sources Section */}
          {response.sources && response.sources.length > 0 && (
            <div className={cn("content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full")}>
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className={cn("content-stretch flex gap-[8px] items-center relative shrink-0 cursor-pointer hover:opacity-70 transition-opacity")}
              >
                <div className="relative shrink-0 size-[16px] text-[#0089d0]">
                  <SourcesIcon className="w-full h-full" />
                </div>
                <p className={cn("font-cachet font-medium leading-[20px] not-italic text-[#231f20] text-[16px]")}>
                  {response.sources.length} {response.sources.length === 1 ? 'Source' : 'Sources'}
                </p>
                <div className={cn("relative shrink-0 size-[16px] text-[#636466] transition-transform", sourcesExpanded && "rotate-180")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              {sourcesExpanded && (
                <div className={cn("content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full")}>
                  {response.sources.map((source, index) => (
                    <div key={source.id || index} className={cn("bg-[#f9fafb] border border-[#e5e7eb] border-solid content-stretch flex flex-col gap-[8px] items-start p-[16px] relative rounded-[8px] shrink-0 w-full")}>
                      <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full">
                        <p className={cn("font-cachet font-medium leading-[20px] not-italic text-[#231f20] text-[14px]")}>
                          {source.title}
                        </p>
                        <p className={cn("font-verdana font-normal leading-[18px] not-italic text-[#636466] text-[12px]")}>
                          {source.source}
                        </p>
                      </div>
                      {source.excerpt && (
                        <p className={cn("font-verdana font-normal leading-[20px] not-italic text-[#231f20] text-[14px]")}>
                          {source.excerpt}
                        </p>
                      )}
                      {source.sourceUrl && (
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn("font-verdana font-medium leading-[18px] not-italic text-[#0089d0] text-[12px] hover:underline cursor-pointer")}
                        >
                          View Source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Explore Further */}
          {exploreFurther && exploreFurther.length > 0 && (
            <div className={cn("content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full")}>
              <p className={cn("font-medium leading-[20px] not-italic text-[#636466] text-[14px]")}>
                Explore further:
              </p>
              <div className={cn("content-start flex flex-wrap gap-[16px] items-start relative shrink-0 w-full")}>
                {exploreFurther.slice(0, 3).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className={cn("bg-[rgba(0,137,208,0.1)] border border-[rgba(0,137,208,0.3)] border-solid flex gap-[8px] items-center px-[21px] py-[12px] relative rounded-[20px] hover:bg-[rgba(0,137,208,0.2)] transition-colors cursor-pointer h-auto max-w-full")}
                  >
                    <p className="font-normal leading-[20px] not-italic text-[#231f20] text-[14px] text-left break-words whitespace-normal w-full">
                      {suggestion}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

// Starter prompts data with translation keys
const getStarterPrompts = (t: any) => [
  {
    id: 'crisis',
    titleKey: 'starterCrisisTitle',
    descKey: 'starterCrisisDesc',
    icon: ShieldIcon,
    color: '#EE3124',
    prompt: 'Tell me about how the YMCA responded during times of crisis in history'
  },
  {
    id: 'youth',
    titleKey: 'starterYouthTitle',
    descKey: 'starterYouthDesc',
    icon: SparklesIcon,
    color: '#00AEEF',
    prompt: 'How did YMCA youth programs evolve through the decades?'
  },
  {
    id: 'leadership',
    titleKey: 'starterLeadershipTitle',
    descKey: 'starterLeadershipDesc',
    icon: UsersIcon,
    color: '#92278F',
    prompt: 'Share stories about YMCA leadership and social responsibility'
  },
  {
    id: 'innovation',
    titleKey: 'starterInnovationTitle',
    descKey: 'starterInnovationDesc',
    icon: LightbulbIcon,
    color: '#FDB913',
    prompt: 'What innovations did the YMCA introduce throughout its history?'
  }
];

/**
 * Main Chat Page Component
 */
export default function ChatPage() {
  const { t } = useTranslation();
  const { sendMessage, isLoading, conversation } = useChat();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      setInputValue(suggestion);
      // Optionally, auto-submit the suggestion
      // sendMessage(suggestion);
    }
  };

  const handleStarterPromptClick = (prompt: string) => {
    if (!isLoading) {
      sendMessage(prompt);
    }
  };

  return (
    <div
      className={cn("content-stretch flex flex-col items-start relative size-full min-h-screen bg-[#E1F4FA]")}
    >
      {/* Header */}
      <div className="content-stretch flex flex-col items-center justify-center px-[100px] py-0 relative shrink-0 w-full">
        <div className="content-stretch flex items-center px-[24px] py-[24px] relative shrink-0 w-full">
          <Link href="/" className="h-[72px] w-[94.161px] relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity p-[8px] -m-[8px]">
            <img alt="YMCA Logo" className="w-full h-full object-contain" src="/logo.png" />
          </Link>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 content-stretch flex flex-col items-center relative shrink-0 w-full overflow-y-auto">
        <div className="content-stretch flex flex-col gap-[40px] items-start max-w-[1240px] px-[24px] py-[64px] relative shrink-0 w-full">

          {/* Welcome Message with Starter Prompts */}
          {(!conversation?.messages || conversation.messages.length === 0) && (
            <div className={cn("content-stretch flex flex-col items-center gap-[64px] relative shrink-0 w-full")}>
              {/* Heading */}
              <div className={cn("content-stretch flex flex-col gap-[16px] items-center not-italic relative shrink-0 text-center")}>
                <h1 className={cn("font-cachet font-bold leading-normal relative shrink-0 text-[#231f20] text-[48px]")}>
                  {t('welcomeTitle')}
                </h1>
                <p className={cn("font-verdana font-normal leading-[1.5] relative shrink-0 text-[#484848] text-[20px] max-w-[800px]")}>
                  {t('welcomeSubtitle')}
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0 w-full">
                {/* First Row */}
                <div className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full">
                  {getStarterPrompts(t).slice(0, 2).map((prompt) => {
                    const IconComponent = prompt.icon;
                    return (
                      <button
                        key={prompt.id}
                        onClick={() => handleStarterPromptClick(prompt.prompt)}
                        className={cn("basis-0 bg-white border border-[#d1d5dc] border-solid content-stretch flex grow items-center min-h-px min-w-px px-[16px] py-[16px] relative rounded-[12px] shrink-0 transition-colors cursor-pointer")}
                        style={{ ['--hover-color' as any]: prompt.color }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = prompt.color}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5dc'}
                      >
                        <div className={cn("basis-0 content-stretch flex flex-col gap-[12px] grow items-start min-h-px min-w-px relative shrink-0")}>
                          <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0 w-full")}>
                            <div className="relative shrink-0 size-[40px]">
                              <IconComponent />
                            </div>
                            <p className={cn("font-cachet basis-0 font-medium grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                              {t(prompt.titleKey)}
                            </p>
                          </div>
                          <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                            {t(prompt.descKey)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Second Row */}
                <div className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full">
                  {getStarterPrompts(t).slice(2, 4).map((prompt) => {
                    const IconComponent = prompt.icon;
                    return (
                      <button
                        key={prompt.id}
                        onClick={() => handleStarterPromptClick(prompt.prompt)}
                        className={cn("basis-0 bg-white border border-[#d1d5dc] border-solid content-stretch flex flex-col grow items-start min-h-px min-w-px relative rounded-[12px] shrink-0 transition-colors cursor-pointer")}
                        style={{ ['--hover-color' as any]: prompt.color }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = prompt.color}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5dc'}
                      >
                        <div className={cn("content-stretch flex flex-col gap-[12px] items-start p-[16px] relative shrink-0 w-full")}>
                          <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0 w-full")}>
                            <div className="relative shrink-0 size-[40px]">
                              <IconComponent />
                            </div>
                            <p className={cn("font-cachet basis-0 font-medium grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                              {t(prompt.titleKey)}
                            </p>
                          </div>
                          <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                            {t(prompt.descKey)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {conversation?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} onSuggestionClick={handleSuggestionClick} />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="content-stretch flex items-start relative shrink-0 w-full sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-[32px] pb-[24px]">
        <div className="content-stretch flex flex-col items-center max-w-[1240px] px-[24px] mx-auto w-full">
          <form onSubmit={handleSubmit} className="bg-white border border-[#d1d5dc] border-solid content-stretch flex gap-[8px] items-center justify-center pl-[24px] pr-[8px] py-[8px] relative rounded-[12px] shrink-0 w-full">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('inputPlaceholder')}
              className="basis-0 font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[#757575] text-[16px] bg-transparent border-none outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className={cn("bg-[#00B2A9] content-stretch flex flex-col items-start p-[16px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-[#019188] transition-colors disabled:opacity-50 disabled:cursor-not-allowed")}
            >
              <div className="relative shrink-0 size-[24px]">
                <SendIcon />
              </div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
