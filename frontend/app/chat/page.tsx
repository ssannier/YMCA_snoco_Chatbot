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
import { useChat } from '../hooks/useChat';
import { cn } from '../../lib/utils';
import type { ChatResponse, Message } from '../../types/api';

// Icon Components imported from lib/icons
import {
  GlobeIcon,
  ChevronDownIcon,
  SendIcon,
  StoryIcon,
  CalendarIcon,
  LocationIcon,
  KeyPeopleIcon,
  WhyItMatteredIcon,
  LessonsIcon,
  MomentTeachesIcon,
  SourcesIcon
} from '../../lib/icons';

// Logo image
const imgImage3 = "http://localhost:3845/assets/d005aa1de1f0be0acb65a4ca67a096300f4ad73c.png";

/**
 * Message Bubble Component
 */
interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

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

  // Structured response
  if (response.response) {
    const { story, lessonsAndThemes, modernReflection, exploreFurther } = response.response;

    return (
      <div className="bg-white border border-[#d1d5dc] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[12px] shrink-0 w-full max-w-[976px]">
        <div className="content-stretch flex flex-col gap-[40px] items-start p-[40px] relative shrink-0 w-full">

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
                      <button className={cn("font-verdana font-medium leading-[18px] not-italic text-[#0089d0] text-[12px] hover:underline cursor-pointer")}>
                        View Source
                      </button>
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
                    className={cn("bg-[rgba(0,137,208,0.1)] border border-[rgba(0,137,208,0.3)] border-solid content-stretch flex gap-[8px] items-center px-[21px] py-[12px] relative rounded-[100px] shrink-0 hover:bg-[rgba(0,137,208,0.2)] transition-colors cursor-pointer")}
                  >
                    <p className="font-normal leading-[20px] not-italic text-[#231f20] text-[14px]">
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

/**
 * Main Chat Page Component
 */
export default function ChatPage() {
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

  return (
    <div
      className={cn("content-stretch flex flex-col items-start relative size-full min-h-screen bg-[#E1F4FA]")}
    >
      {/* Header */}
      <div className="content-stretch flex flex-col items-center justify-center px-[100px] py-0 relative shrink-0 w-full">
        <div className="content-stretch flex items-center justify-between px-[24px] py-[24px] relative shrink-0 w-full">
          <Link href="/" className="h-[72px] relative shrink-0 w-[94.161px]">
            <img alt="YMCA Logo" className="absolute inset-0 max-w-none object-center object-cover pointer-events-none size-full" src="/logo.png" />
          </Link>
          <div className="bg-white border border-[#d1d5dc] border-solid content-stretch flex gap-[8px] items-center px-[16px] py-[12px] relative rounded-[12px] shrink-0">
            <div className="relative shrink-0 size-[20px] text-[#636466]">
              <GlobeIcon />
            </div>
            <p className="font-medium leading-[24px] not-italic relative shrink-0 text-[#231f20] text-[16px] text-center text-nowrap">
              English
            </p>
            <div className="relative shrink-0 size-[24px] text-[#636466]">
              <ChevronDownIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 content-stretch flex flex-col items-center relative shrink-0 w-full overflow-y-auto">
        <div className="content-stretch flex flex-col gap-[40px] items-start max-w-[1240px] px-[24px] py-[64px] relative shrink-0 w-full">

          {/* Welcome Message */}
          {(!conversation?.messages || conversation.messages.length === 0) && (
            <div className={cn("content-stretch flex flex-col items-center gap-[24px] relative shrink-0 w-full text-center")}>
              <h1 className={cn("font-cachet font-bold text-[48px] text-[#231f20]")}>
                Ask about YMCA history
              </h1>
              <p className={cn("font-verdana font-normal text-[20px] text-[#636466] max-w-[600px]")}>
                Explore stories, discover lessons, and draw insights from the past to inspire leadership today.
              </p>
            </div>
          )}

          {/* Messages */}
          {conversation?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
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
              placeholder="Ask your own question about YMCA history, programs, or leadership…"
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
