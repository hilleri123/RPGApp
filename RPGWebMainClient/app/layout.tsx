import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { AuthProvider } from '@/app/services/providers/AuthProvider';
import { Toaster } from 'sonner';
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useEffect } from "react";
import "./globals.css"
import { authApiService } from "./services/api/auth";
import ClientRootLayout from "./ClientRootLayout";
import { TelegramInitClient } from "./components/layout/TelegramInitClient";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "RPG Sessions - Игровые сессии",
  description: "Платформа для организации и проведения RPG сессий",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="ru" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning={true} className={inter.className}>
        <TelegramInitClient />
        <ClientRootLayout>
          {children}
        </ClientRootLayout>
      </body>
      {/* <AuthProvider>
        <body suppressHydrationWarning={true} className={inter.className}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster richColors position="top-right" />
        </body>
      </AuthProvider> */}
    </html>
  )
}
