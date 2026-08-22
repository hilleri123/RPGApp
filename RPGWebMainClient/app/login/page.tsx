'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2, Loader2 } from "lucide-react";

import LoginForm from '@/app/components/auth/LoginForm';
import RegisterForm from '@/app/components/auth/RegisterForm';
import Header from '@/app/components/layout/Header';
import { safeReturnTo } from '@/app/lib/auth/routes';
import { useAuth } from '@/app/services/hooks/useAuth';

function LoginPageInner() {
  const searchParams = useSearchParams();
  const registerDefault = searchParams.get('register') === '1';
  const [authMode, setAuthMode] = useState<'login' | 'register'>(registerDefault ? 'register' : 'login');
  const { state } = useAuth();

  const router = useRouter();
  const next = useMemo(
    () => safeReturnTo(searchParams.get('next'), '/'),
    [searchParams],
  );

  useEffect(() => {
    if (registerDefault) {
      setAuthMode('register');
    }
  }, [registerDefault]);

  useEffect(() => {
    if (!state.loading && state.isAuthenticated) {
      router.replace(next);
    }
  }, [state.loading, state.isAuthenticated, router, next]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  const handleAuthSuccess = () => {
    router.replace(next);
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
      <Header />

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-white">
              Добро пожаловать в мир приключений
            </h1>
            <p className="text-gray-400">
              Присоединяйтесь к игровым сессиям и создавайте незабываемые истории
            </p>
          </div>

          <Tabs
            value={authMode}
            onValueChange={(value) => setAuthMode(value as 'login' | 'register')}
            className="space-y-6"
          >
            <TabsList className="w-full bg-gray-800">
              <TabsTrigger value="login" className="data-[state=active]:bg-gray-700">
                Вход
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-gray-700">
                Регистрация
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <LoginForm
                onLogin={handleAuthSuccess}
                onSwitchToRegister={() => setAuthMode('register')}
              />
            </TabsContent>

            <TabsContent value="register">
              <RegisterForm
                onRegister={handleAuthSuccess}
                onSwitchToLogin={() => setAuthMode('login')}
              />
            </TabsContent>
          </Tabs>

          <p className="text-center mt-6 text-sm text-gray-500">
            <Link href="/" className="text-blue-400 hover:text-blue-300 underline">
              На главную
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-white">Загрузка...</p>
          </div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
