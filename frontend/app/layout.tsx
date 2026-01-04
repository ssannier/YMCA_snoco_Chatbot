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
      <body
        className={`${montserrat.variable} font-verdana antialiased`}
        style={{
          fontFamily: 'Verdana, Geneva, sans-serif'
        }}
      >
        <ChatProvider>
          {children}
        </ChatProvider>
      </body>
    </html>
  );
}
