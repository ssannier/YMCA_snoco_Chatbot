import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// Load Montserrat as a substitute for Cachet (similar geometric sans-serif)
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YMCA Chatbot - Explore YMCA History",
  description: "Ask questions, discover stories, and draw lessons from the past to inspire leadership today.",
};

import { ChatProvider } from './context/ChatContext';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              function googleTranslateElementInit() {
                new google.translate.TranslateElement(
                  {
                    pageLanguage: 'en',
                    includedLanguages: 'en,es,fr,de,it,pt,zh-CN,ja,ko,ar,hi,ru',
                    layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                    autoDisplay: false
                  },
                  'google_translate_element'
                );
              }
            `,
          }}
        />
        <script
          type="text/javascript"
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        />
      </head>
      <body
        className={`${montserrat.variable} font-verdana antialiased`}
        style={{
          fontFamily: 'Verdana, Geneva, sans-serif'
        }}
      >
        <div id="google_translate_element" style={{ display: 'none' }} />
        <ChatProvider>
          {children}
        </ChatProvider>
      </body>
    </html>
  );
}
