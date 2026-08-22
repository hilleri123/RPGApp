
"use client";
import { AuthProvider } from '@/app/services/providers/AuthProvider';
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from 'sonner';
import { MinimizedDialogDock } from '@/app/components/common/MinimizedDialogDock';
// и прочее
import { useEffect } from "react";
import { authApiService } from "./services/api/auth";


export default function ClientRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // useEffect(() => {
  //   const doTelegramAuth = async () => {
  //     miniApp.mount()
  //     const tg = window.Telegram?.WebApp;
  //     await fetch(`https://byury.online/api/popa?${tg?.initData}`);
  //     console.info(`!!!!!!!!!!!!!!!!!!!`, tg);
  //     if (tg) {
  //       const user = tg.initDataUnsafe.user;
  //       await authApiService.telegram_login(tg.initData, user);
  //     }
  //   };
  //   doTelegramAuth();
  // }, []);

  return (
    <AuthProvider>
      <TooltipProvider>
        {children}
      </TooltipProvider>
      <Toaster richColors position="top-right" />
      <MinimizedDialogDock />
    </AuthProvider>
  )
}
