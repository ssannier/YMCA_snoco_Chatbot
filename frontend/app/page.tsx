"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
import '../lib/i18n';

// Logo image
const ymcaLogo = "/logo.png";

// Supported languages
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ru', name: 'Русский' }
];

export default function Home() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const { sendMessage } = useChat();

  const submitMessage = () => {
    if (inputValue.trim()) {
      // Send the message using the chat hook
      sendMessage(inputValue);
      // Navigate to chat page
      router.push('/chat');
      // Clear input
      setInputValue('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage();
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
      submitMessage();
    }
  };

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    setLanguageDropdownOpen(false);
    i18n.changeLanguage(languageCode);
  };

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (languageDropdownOpen && !target.closest('.language-selector')) {
        setLanguageDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [languageDropdownOpen]);

  return (
    <div className={cn("content-stretch flex flex-col items-start relative size-full min-h-screen bg-[#E1F4FA]")}>
      {/* Header */}
      <div className={cn("content-stretch flex flex-col items-center justify-center px-[100px] py-0 relative shrink-0 w-full")}>
        <div className={cn("content-stretch flex items-center justify-between px-[24px] py-[24px] relative shrink-0 w-full")}>
          <div className={cn("h-[72px] w-[94.161px] relative shrink-0")}>
            <img alt="YMCA Logo" className="w-full h-full object-contain" src={ymcaLogo} />
          </div>
          <div className="relative language-selector">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLanguageDropdownOpen(!languageDropdownOpen);
              }}
              className="bg-white border border-[#d1d5dc] border-solid content-stretch flex gap-[8px] items-center px-[16px] py-[12px] relative rounded-[12px] shrink-0 hover:border-[#0089d0] transition-colors cursor-pointer"
            >
              <div className="relative shrink-0 size-[20px] text-[#636466]">
                <Image src="/globeicon.svg" alt="Globe icon" width={20} height={20} />
              </div>
              <p className="font-medium leading-[24px] not-italic relative shrink-0 text-[#231f20] text-[16px] text-center text-nowrap">
                {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name || 'English'}
              </p>
              <div className={cn("relative shrink-0 size-[24px] text-[#636466] transition-transform", languageDropdownOpen && "rotate-180")}>
                <ChevronDownIcon />
              </div>
            </button>

            {languageDropdownOpen && (
              <div className="absolute right-0 top-full mt-[8px] bg-white border border-[#d1d5dc] rounded-[12px] shadow-lg overflow-hidden z-50 min-w-[200px]">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLanguageChange(lang.code);
                    }}
                    className={cn(
                      "w-full text-left px-[16px] py-[12px] hover:bg-[#f9fafb] transition-colors cursor-pointer",
                      selectedLanguage === lang.code && "bg-[#E1F4FA] text-[#0089d0] font-medium"
                    )}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
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
                {t('welcomeTitle')}
              </h1>
              <p className={cn("font-verdana font-normal leading-[1.5] relative shrink-0 text-[#484848] text-[20px] w-[800px] max-w-full")}>
                {t('welcomeSubtitle')}
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
                          {t('starterCrisisTitle')}
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        {t('starterCrisisDesc')}
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
                          {t('starterYouthTitle')}
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        {t('starterYouthDesc')}
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
                          {t('starterLeadershipTitle')}
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        {t('starterLeadershipDesc')}
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
                          {t('starterInnovationTitle')}
                        </p>
                      </div>
                      <p className={cn("font-verdana font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full")}>
                        {t('starterInnovationDesc')}
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
                  placeholder={t('inputPlaceholder')}
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
