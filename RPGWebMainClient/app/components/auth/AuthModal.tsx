'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoginForm from '@/app/components/auth/LoginForm';
import RegisterForm from '@/app/components/auth/RegisterForm';

export type AuthModalMode = 'login' | 'register';

export function AuthModal({
  open,
  onOpenChange,
  mode = 'login',
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: AuthModalMode;
  onSuccess?: () => void;
}) {
  const [authMode, setAuthMode] = useState<AuthModalMode>(mode);

  useEffect(() => {
    if (open) setAuthMode(mode);
  }, [open, mode]);

  const handleSuccess = (_user?: unknown) => {
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-700 text-gray-100 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="sr-only">
            {authMode === 'login' ? 'Вход' : 'Регистрация'}
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          <Tabs
            value={authMode}
            onValueChange={(v) => setAuthMode(v as AuthModalMode)}
            className="space-y-4"
          >
            <TabsList className="w-full bg-gray-800">
              <TabsTrigger value="login" className="data-[state=active]:bg-gray-700">
                Вход
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-gray-700">
                Регистрация
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-0">
              <LoginForm
                onLogin={handleSuccess}
                onSwitchToRegister={() => setAuthMode('register')}
              />
            </TabsContent>
            <TabsContent value="register" className="mt-0">
              <RegisterForm
                onRegister={handleSuccess}
                onSwitchToLogin={() => setAuthMode('login')}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
