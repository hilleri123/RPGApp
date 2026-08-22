'use client';


import { Suspense, useContext, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SessionSocketContext, SessionWebSocketProvider } from "@/app/services/providers/SessionWebSocketProvider";
import { useSessionsStore } from "@/app/services/stores/sessions";
import SessionMasterPage from "@/app/components/session/masterView/SessionMasterPage";
import MasterScenePopoutPage from "@/app/components/session/masterView/scene/MasterScenePopoutPage";
import PlayerMirrorPage from "@/app/components/session/masterView/playerMirror/PlayerMirrorPage";
import SessionPlayerPage from "@/app/components/session/playerView/SessionPlayerPage";
import { RequireAuth } from "@/app/components/auth/RequireAuth";
import { Button } from "@/components/ui/button";


/** Сколько ждём session_init, прежде чем признать, что он не придёт. */
const INIT_TIMEOUT_MS = 10000;


export default function SessionPageWrapper() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        }
      >
        <SessionPageWithSocket sessionId={params.id} />
      </Suspense>
    </RequireAuth>
  );
}

function SessionPageWithSocket({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const viewAsPlayer = searchParams.get('viewAsPlayer');
  const commandReadOnly = Boolean(viewAsPlayer);

  return (
    <SessionWebSocketProvider sessionId={sessionId} commandReadOnly={commandReadOnly}>
      <SessionGate sessionId={sessionId} />
    </SessionWebSocketProvider>
  );
}

function SessionScreen({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="flex justify-center">{icon}</div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-gray-400">{hint}</p>
        {children}
      </div>
    </div>
  );
}

function SessionGate({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPopout = searchParams.get('popout') === '1';
  const popoutSceneId = searchParams.get('scene');
  const viewAsPlayer = searchParams.get('viewAsPlayer');

  const sessionData = useSessionsStore(s => s.sessions[sessionId]);
  const ctx = useContext(SessionSocketContext);
  const connected = ctx?.connected ?? false;

  const isMaster = sessionData?.isMaster;
  const isPlayer = sessionData?.isPlayer;

  // Спиннер крутился вечно, если session_init не приходил: сессия завершена,
  // нет прав или сокет не поднялся. Теперь ожидание конечное.
  const [initTimedOut, setInitTimedOut] = useState(false);
  useEffect(() => {
    if (sessionData) return;
    const timer = setTimeout(() => setInitTimedOut(true), INIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [sessionData, sessionId]);

  if (!sessionData) {
    if (initTimedOut) {
      return (
        <SessionScreen
          icon={<AlertTriangle className="w-10 h-10 text-amber-500" />}
          title="Не удалось загрузить сессию"
          hint={
            connected
              ? 'Связь есть, но сессия не отвечает. Возможно, она уже завершена или у вас нет к ней доступа.'
              : 'Соединение с сервером не установлено. Проверьте сеть и попробуйте снова.'
          }
        >
          <div className="flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Переподключиться
            </Button>
            <Button variant="outline" onClick={() => router.push('/')}>
              К списку лобби
            </Button>
          </div>
        </SessionScreen>
      );
    }

    return (
      <SessionScreen
        icon={<Loader2 className="w-8 h-8 animate-spin text-blue-500" />}
        title="Подключаемся к сессии"
        hint={connected ? 'Ждём данные сессии...' : 'Устанавливаем соединение...'}
      />
    );
  }

  if (isPlayer && !isPopout && !viewAsPlayer) return <SessionPlayerPage sessionId={sessionId} />;
  if (isMaster) {
    if (viewAsPlayer) {
      return <PlayerMirrorPage sessionId={sessionId} playerUserId={String(viewAsPlayer)} />;
    }
    if (isPopout && popoutSceneId) {
      return <MasterScenePopoutPage sceneId={String(popoutSceneId)} />;
    }
    return <SessionMasterPage />;
  }

  return (
    <SessionScreen
      icon={<AlertTriangle className="w-10 h-10 text-amber-500" />}
      title="В этой сессии у вас нет роли"
      hint="Вы не мастер и не игрок этой сессии. Попросите мастера добавить вас через лобби."
    >
      <Button variant="outline" onClick={() => router.push('/')}>
        К списку лобби
      </Button>
    </SessionScreen>
  );
}
