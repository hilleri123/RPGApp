'use client'
import { useEffect } from "react"

export function TelegramInitClient() {
  useEffect(() => {
    let tries = 0;
    const tryInit = async () => {
      if (typeof window === "undefined") return;
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        if (tries++ < 10) setTimeout(tryInit, 100); // 10 попыток с задержкой 100 мс
        else console.warn("Telegram WebApp API not available (timeout)");
        return;
      }
      try {
        const WebApp = (await import("@twa-dev/sdk")).default
        WebApp.ready();
        WebApp.expand();
        WebApp.enableClosingConfirmation();
        if (WebApp.disableVerticalSwipes) WebApp.disableVerticalSwipes();
        // if (WebApp.lockOrientation) WebApp.lockOrientation();
        // if (WebApp.requestFullscreen) WebApp.requestFullscreen();
      } catch (err) {
        console.warn("Ошибка инициализации Telegram WebApp:", err);
      }
    };

    tryInit();
    // eslint-disable-next-line
  }, []);
  return null;
}
