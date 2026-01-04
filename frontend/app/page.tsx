"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '../lib/utils';
import { useChat } from './hooks/useChat';
import {
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  LightbulbIcon,
  SendIcon,
  ChevronDownIcon
} from '../lib/icons';

// Logo image
const ymcaLogo = "/logo.png";

export default function Home() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const { sendMessage } = useChat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      // Send the message using the chat hook
      sendMessage(inputValue);
      // Navigate to chat page
      router.push('/chat');
      // Clear input
      setInputValue('');
    }
  };

  const handleStarterPromptClick = (prompt: string) => {
    // Send the message
    sendMessage(prompt);
    // Navigate to chat page
    router.push('/chat');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className={cn("content-stretch flex flex-col items-start relative size-full min-h-screen bg-[#E1F4FA]")}>
      {/* Header */}
      <div className={cn("content-stretch flex flex-col items-center justify-center px-[100px] py-0 relative shrink-0 w-full")}>
        <div className={cn("content-stretch flex items-center justify-between px-[24px] py-[24px] relative shrink-0 w-full")}>
          <div className={cn("h-[72px] w-[94.161px] relative shrink-0")}>
            <img alt="YMCA Logo" className="w-full h-full object-contain" src={ymcaLogo} />
          </div>
          <div className="bg-white border border-[#d1d5dc] border-solid content-stretch flex gap-[8px] items-center px-[16px] py-[12px] relative rounded-[12px] shrink-0">
            <div className="relative shrink-0 size-[20px] text-[#636466]">
              <Image src="/globeicon.svg" alt="Globe icon" width={20} height={20} />
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

      {/* Main Content */}
      <div className="basis-0 content-stretch flex flex-col grow items-center min-h-px min-w-px relative shrink-0 w-full">
        <div className="basis-0 content-stretch flex flex-col grow items-center justify-between max-w-[1240px] min-h-px min-w-px px-[24px] py-[64px] relative shrink-0 w-full">
          <div className="content-stretch flex flex-col gap-[64px] items-center relative shrink-0 w-full">
            {/* Heading */}
            <div className={cn("content-stretch flex flex-col gap-[16px] items-center not-italic relative shrink-0 text-center")}>
              <h1 className={cn("font-cachet font-bold leading-normal min-w-full relative shrink-0 text-[#231f20] text-[64px] w-[min-content]")}>
                Explore the history that shaped today&apos;s YMCA.
              </h1>
              <p className={cn("font-verdana font-normal leading-[1.5] relative shrink-0 text-[#484848] text-[20px] w-[800px] max-w-full")}>
                Ask questions, discover stories, and draw lessons from the past to inspire leadership today.
              </p>
            </div>

            {/* Topic Cards */}
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-full">
              <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0 w-full">
                {/* First Row */}
                <div className="content-stretch flex gap-[24px] items-start max-w-[1200px] relative shrink-0 w-full">
                  {/* Card 1 - Crisis */}
                  <button
                    type="button"
                    onClick={() => handleStarterPromptClick('Tell me about how the YMCA responded during times of crisis in history')}
                    className={cn("basis-0 bg-white border border-[#d1d5dc] border-solid content-stretch flex grow items-center min-h-px min-w-px px-[16px] py-[16px] relative rounded-[12px] shrink-0 hover:border-[#EE3124] transition-colors cursor-pointer")}
                  >
                    <div className={cn("basis-0 content-stretch flex flex-col gap-[12px] grow items-start min-h-px min-w-px relative shrink-0")}>
                      <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0 w-full")}>
                        <div className="relative shrink-0 size-[40px]">
                          <ShieldIcon />
                        </div>
                        <p className={cn("font-cachet basis-0 font-medium grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                          The YMCA in Times of Crisis
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        How the Y responded when communities needed it most
                      </p>
                    </div>
                  </button>

                  {/* Card 2 - Youth Programs */}
                  <button
                    type="button"
                    onClick={() => handleStarterPromptClick('How did YMCA youth programs evolve through the decades?')}
                    className={cn("basis-0 bg-white border border-[#d1d5dc] border-solid content-stretch flex flex-col grow items-start min-h-px min-w-px relative rounded-[12px] shrink-0 hover:border-[#00AEEF] transition-colors cursor-pointer")}
                  >
                    <div className={cn("content-stretch flex flex-col gap-[12px] items-start p-[16px] relative shrink-0 w-full")}>
                      <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0 w-full")}>
                        <div className="relative shrink-0 size-[40px]">
                          <SparklesIcon />
                        </div>
                        <p className={cn("font-cachet basis-0 font-medium grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                          Youth Programs Through the Decades
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        How the Y shaped young lives across generations
                      </p>
                    </div>
                  </button>
                </div>

                {/* Second Row */}
                <div className="content-stretch flex gap-[24px] items-start max-w-[1200px] relative shrink-0 w-full">
                  {/* Card 3 - Leadership */}
                  <button
                    type="button"
                    onClick={() => handleStarterPromptClick('Share stories about YMCA leadership and social responsibility')}
                    className={cn("basis-0 bg-white border border-[#d1d5dc] border-solid content-stretch flex flex-col grow items-start min-h-px min-w-px relative rounded-[12px] shrink-0 hover:border-[#92278F] transition-colors cursor-pointer")}
                  >
                    <div className={cn("content-stretch flex flex-col gap-[12px] items-start p-[16px] relative shrink-0 w-full")}>
                      <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0 w-full")}>
                        <div className="relative shrink-0 size-[40px]">
                          <UsersIcon />
                        </div>
                        <p className={cn("font-cachet basis-0 font-medium grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                          Leadership &amp; Social Responsibility
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        Stories of courage, change, and moral leadership
                      </p>
                    </div>
                  </button>

                  {/* Card 4 - Innovation */}
                  <button
                    type="button"
                    onClick={() => handleStarterPromptClick('What innovations did the YMCA introduce throughout its history?')}
                    className={cn("basis-0 bg-white border border-[#d1d5dc] border-solid content-stretch flex flex-col grow items-start min-h-px min-w-px relative rounded-[12px] shrink-0 hover:border-[#FDB913] transition-colors cursor-pointer")}
                  >
                    <div className={cn("content-stretch flex flex-col gap-[12px] items-start p-[16px] relative shrink-0 w-full")}>
                      <div className={cn("content-stretch flex gap-[8px] items-center relative shrink-0 w-full")}>
                        <div className="relative shrink-0 size-[40px]">
                          <LightbulbIcon />
                        </div>
                        <p className={cn("font-cachet basis-0 font-medium grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                          Innovation and Change at the Y
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        From basketball to new models of community service
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className={cn("content-stretch flex items-start relative shrink-0 w-full")}>
            <div className={cn("basis-0 content-stretch flex flex-col grow items-center min-h-px min-w-px relative shrink-0")}>
              <form onSubmit={handleSubmit} className={cn("bg-white border border-[#d1d5dc] border-solid content-stretch flex gap-[8px] items-center justify-center pl-[24px] pr-[8px] py-[8px] relative rounded-[12px] shrink-0 w-full hover:border-[#00B2A9] transition-colors")}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your own question about YMCA history, programs, or leadership…"
                  className={cn("basis-0 font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[#231f20] text-[16px] bg-transparent border-none outline-none placeholder:text-[#757575]")}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className={cn("bg-[#00B2A9] content-stretch flex flex-col items-start p-[16px] relative rounded-[12px] shrink-0 hover:bg-[#019188] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed")}
                >
                  <div className={cn("relative shrink-0 size-[24px]")}>
                    <SendIcon />
                  </div>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
