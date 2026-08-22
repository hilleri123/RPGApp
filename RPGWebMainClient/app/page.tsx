'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Gamepad2,
  Users,
  Loader2,
  Eye,
} from "lucide-react";

import Header from '@/app/components/layout/Header';
import LobbyList from '@/app/components/lobby/LobbyList';
import { ProfileDashboard } from '@/app/components/profile/ProfileDashboard';
import { computeProfileSessionStats } from '@/app/components/profile/sessionHistoryUtils';
import { sessionApiService } from '@/app/services/api/session';
import { campaignsApiService } from '@/app/services/api/campaign';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import { applicationApiService } from '@/app/services/api/application';
import { userApiService, type RollListResponse } from '@/app/services/api/users';
import { useAuth } from '@/app/services/hooks/useAuth';
import { GameSessionPreview } from '@/app/services/types/session';
import type { CampaignProfile } from '@/app/services/types/sessionDispatch';
import { AuthModal, type AuthModalMode } from '@/app/components/auth/AuthModal';

function GuestHomeLanding() {
  const searchParams = useSearchParams();
  const initialMode: AuthModalMode =
    searchParams.get('auth') === 'register' || searchParams.get('register') === '1'
      ? 'register'
      : 'login';
  const wantOpen =
    searchParams.get('auth') === '1' ||
    searchParams.get('auth') === 'login' ||
    searchParams.get('auth') === 'register' ||
    searchParams.get('register') === '1';

  const [authOpen, setAuthOpen] = useState(wantOpen);
  const [authMode, setAuthMode] = useState<AuthModalMode>(initialMode);

  useEffect(() => {
    if (wantOpen) {
      setAuthMode(initialMode);
      setAuthOpen(true);
    }
  }, [wantOpen, initialMode]);

  const openAuth = (mode: AuthModalMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <Header
        onLoginClick={() => openAuth('login')}
        onRegisterClick={() => openAuth('register')}
      />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
            <Gamepad2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">RPG Master</h1>
          <p className="text-gray-400 text-lg">
            Организуйте игровые сессии, ведите кампании и играйте с друзьями онлайн.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              onClick={() => openAuth('login')}
            >
              Войти
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-gray-600 text-gray-200"
              onClick={() => openAuth('register')}
            >
              Регистрация
            </Button>
          </div>
          <Link href="/observer" className="inline-block pt-2">
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto bg-violet-600/90 hover:bg-violet-600 text-white gap-2"
            >
              <Eye className="w-5 h-5" />
              Смотреть игры (наблюдатель)
            </Button>
          </Link>
          <p className="text-sm text-gray-500 pt-4">
            В Telegram отправьте боту команду{' '}
            <span className="text-gray-300 font-mono">/link</span>
            {' '}— получите ссылку для входа без пароля.
          </p>
        </div>
      </main>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onOpenChange={setAuthOpen}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const { state } = useAuth();
  const { user, isAuthenticated, loading } = state;
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'profile' ? 'profile' : 'sessions';
  const [sessions, setSessions] = useState<GameSessionPreview[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [profile, setProfile] = useState<CampaignProfile | null>(null);
  const [launchedCount, setLaunchedCount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [charactersCount, setCharactersCount] = useState<number | null>(null);
  const [rolls, setRolls] = useState<RollListResponse | null>(null);
  const [rollsLoading, setRollsLoading] = useState(true);

  const loadSessions = () => {
    if (!isAuthenticated) {
      setSessions([]);
      setSessionsLoading(false);
      return Promise.resolve();
    }
    setSessionsLoading(true);
    return sessionApiService
      .getSessions()
      .then((data) => setSessions(data))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    void loadSessions();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      setProfileLoading(false);
      setLaunchedCount(null);
      setCharactersCount(null);
      return;
    }

    setProfileLoading(true);
    void Promise.all([
      campaignsApiService.getProfile().then(setProfile).catch(() => setProfile(null)),
      applicationApiService.getList({ limit: 500 }).then((list) => setCharactersCount(list.length)).catch(() => setCharactersCount(null)),
      launchedScenariosApi.list().then((list) => setLaunchedCount(list.length)).catch(() => setLaunchedCount(null)),
    ]).finally(() => setProfileLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRolls(null);
      setRollsLoading(false);
      return;
    }
    setRollsLoading(true);
    userApiService
      .getMyRolls({ limit: 20 })
      .then(setRolls)
      .catch(() => setRolls(null))
      .finally(() => setRollsLoading(false));
  }, [isAuthenticated]);

  const sessionStats = useMemo(
    () => computeProfileSessionStats(profile?.session_history ?? []),
    [profile?.session_history],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <GuestHomeLanding />
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <Header />

      <div className="container mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Tabs defaultValue={initialTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <TabsList className="bg-gray-800 border-gray-700 w-fit">
              <TabsTrigger value="sessions" className="data-[state=active]:bg-gray-700">
                <Gamepad2 className="w-4 h-4 mr-2" />
                Игровые сессии
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-gray-700">
                <Users className="w-4 h-4 mr-2" />
                Профиль
              </TabsTrigger>
            </TabsList>
              <Link
                href="/observer"
                className="text-sm text-gray-500 hover:text-violet-300 flex items-center gap-1.5 w-fit"
              >
                <Eye className="w-3.5 h-3.5" />
                Режим наблюдателя
              </Link>
            </div>

            <LobbyList
              section="sessions"
              sessions={sessions}
              onRefreshSessions={loadSessions}
            />

            <TabsContent value="profile" className="space-y-6">
              {user && (
                <ProfileDashboard
                  user={user}
                  sessionStats={sessionStats}
                  sessionHistory={profile?.session_history ?? []}
                  profileLoading={profileLoading}
                  charactersCount={charactersCount}
                  launchedCount={launchedCount}
                  sessions={sessions}
                  sessionsLoading={sessionsLoading}
                  rolls={rolls}
                  rollsLoading={rollsLoading}
                />
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
