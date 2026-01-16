"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { cn } from '../lib/utils';
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

  const submitMessage = () => {
    if (inputValue.trim()) {
      // Store message in sessionStorage for chat page to pick up
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingMessage', inputValue);
      }
      // Navigate to chat page (chat page will handle sending)
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
    // Store message in sessionStorage for chat page to pick up
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pendingMessage', prompt);
    }
    // Navigate to chat page (chat page will handle sending)
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
            <Image alt="YMCA Logo" className="object-contain" src={ymcaLogo} fill />
          </div>
          <div className="flex gap-[12px] items-center">
            {/* Admin Button */}
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="bg-white border border-[#d1d5dc] border-solid content-stretch flex gap-[8px] items-center px-[16px] py-[12px] relative rounded-[12px] shrink-0 hover:border-[#92278F] hover:text-[#92278F] transition-colors cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative shrink-0">
                <path d="M10 10C12.7614 10 15 7.76142 15 5C15 2.23858 12.7614 0 10 0C7.23858 0 5 2.23858 5 5C5 7.76142 7.23858 10 10 10Z" fill="currentColor" />
                <path d="M10 12.5C5.16667 12.5 1.25 14.4583 1.25 16.875V20H18.75V16.875C18.75 14.4583 14.8333 12.5 10 12.5Z" fill="currentColor" />
              </svg>
              <p className="font-medium leading-[24px] not-italic relative shrink-0 text-[#231f20] text-[16px] text-center text-nowrap">
                Are you an Admin?
              </p>
            </button>

            {/* Language Selector */}
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
              <p className={cn("font-normal leading-[1.5] relative shrink-0 text-[#484848] text-[20px] w-[800px] max-w-full")}>
                {t('welcomeSubtitle')}
              </p>
            </div>

            {/* Topic Cards */}
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px] w-full max-w-[960px] items-stretch">
                {/* Card 1 - Crisis */}
                <button
                  type="button"
                  onClick={() => handleStarterPromptClick('Tell me about how the YMCA responded during times of crisis in history')}
                  className={cn("bg-white border border-[#d1d5dc] border-solid flex flex-col items-center justify-center p-[24px] relative rounded-[12px] hover:border-[#EE3124] transition-colors cursor-pointer h-full gap-[12px]")}
                >
                  <div className={cn("flex gap-[8px] items-center justify-center relative shrink-0 w-full")}>
                    <div className="relative shrink-0 size-[40px] text-[#EE3124]">
                      <ShieldIcon />
                    </div>
                    <p className={cn("font-cachet font-medium leading-[20px] not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                      {t('starterCrisisTitle')}
                    </p>
                  </div>
                  <p className={cn("font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full text-center")}>
                    {t('starterCrisisDesc')}
                  </p>
                </button>

                {/* Card 2 - Youth Programs */}
                <button
                  type="button"
                  onClick={() => handleStarterPromptClick('How did YMCA youth programs evolve through the decades?')}
                  className={cn("bg-white border border-[#d1d5dc] border-solid flex flex-col items-center justify-center p-[24px] relative rounded-[12px] hover:border-[#00AEEF] transition-colors cursor-pointer h-full gap-[12px]")}
                >
                  <div className={cn("flex gap-[8px] items-center justify-center relative shrink-0 w-full")}>
                    <div className="relative shrink-0 size-[40px] text-[#00AEEF]">
                      <SparklesIcon />
                    </div>
                    <p className={cn("font-cachet font-medium leading-[20px] not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                      {t('starterYouthTitle')}
                    </p>
                  </div>
                  <p className={cn("font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full text-center")}>
                    {t('starterYouthDesc')}
                  </p>
                </button>

                {/* Card 3 - Leadership */}
                <button
                  type="button"
                  onClick={() => handleStarterPromptClick('Share stories about YMCA leadership and social responsibility')}
                  className={cn("bg-white border border-[#d1d5dc] border-solid flex flex-col items-center justify-center p-[24px] relative rounded-[12px] hover:border-[#92278F] transition-colors cursor-pointer h-full gap-[12px]")}
                >
                  <div className={cn("flex gap-[8px] items-center justify-center relative shrink-0 w-full")}>
                    <div className="relative shrink-0 size-[40px] text-[#92278F]">
                      <UsersIcon />
                    </div>
                    <p className={cn("font-cachet font-medium leading-[20px] not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                      {t('starterLeadershipTitle')}
                    </p>
                  </div>
                  <p className={cn("font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full text-center")}>
                    {t('starterLeadershipDesc')}
                  </p>
                </button>

                {/* Card 4 - Innovation */}
                <button
                  type="button"
                  onClick={() => handleStarterPromptClick('What innovations did the YMCA introduce throughout its history?')}
                  className={cn("bg-white border border-[#d1d5dc] border-solid flex flex-col items-center justify-center p-[24px] relative rounded-[12px] hover:border-[#FDB913] transition-colors cursor-pointer h-full gap-[12px]")}
                >
                  <div className={cn("flex gap-[8px] items-center justify-center relative shrink-0 w-full")}>
                    <div className="relative shrink-0 size-[40px] text-[#FDB913]">
                      <LightbulbIcon />
                    </div>
                    <p className={cn("font-cachet font-medium leading-[20px] not-italic relative shrink-0 text-[#231f20] text-[20px]")}>
                      {t('starterInnovationTitle')}
                    </p>
                  </div>
                  <p className={cn("font-normal leading-[1.5] not-italic relative shrink-0 text-[#636466] text-[16px] w-full text-center")}>
                    {t('starterInnovationDesc')}
                  </p>
                </button>
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
