import type { Metadata } from "next";

import "./globals.css";

import localFont from "next/font/local";
import "./globals.css";

const cachet = localFont({
  src: [
    {
      path: '../Cachet Std Book.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../Cachet Std Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../Cachet Std Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-cachet',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "YMCA Chatbot - Explore YMCA History",
  description: "Ask questions, discover stories, and draw lessons from the past to inspire leadership today.",
};

import { ChatProvider } from './context/ChatContext';
import ConfigureAmplify from '../components/ConfigureAmplify';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${cachet.variable} font-sans antialiased`}
      >
        <ConfigureAmplify />
        <ChatProvider>
          {children}
        </ChatProvider>
      </body>
    </html>
  );
}
