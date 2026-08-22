'use client';

import Link from 'next/link';
import Header from '@/app/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Download, Mail } from 'lucide-react';
import { CONTACT_CHANNELS, USER_GUIDE } from './contacts-config';

export default function ContactsPage() {
  const channels = CONTACT_CHANNELS.filter((channel) => channel.value);

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
      <Header section="Контакты" />

      <main className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <h1 className="text-2xl font-bold text-white mb-2">Контакты</h1>
        <p className="text-gray-400 mb-8">
          Здесь можно скачать руководство пользователя и написать нам, если что-то не работает.
        </p>

        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Руководство пользователя
            </CardTitle>
            <CardDescription className="text-gray-400">
              Как играть, как вести игру и что делать, когда экран пустой. Отдельные главы для
              игрока, мастера, наблюдателя и администратора.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={USER_GUIDE.href} download={USER_GUIDE.fileName}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Скачать PDF
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5 text-blue-400" />
              Связаться с нами
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Контакты пока не заполнены. Владельцу площадки: адреса задаются в{' '}
                <code className="text-gray-300">app/contacts/contacts-config.ts</code>.
              </p>
            ) : (
              <ul className="space-y-4">
                {channels.map((channel) => (
                  <li key={channel.label}>
                    <div className="text-sm text-gray-400">{channel.label}</div>
                    {channel.href ? (
                      <a
                        href={channel.href}
                        className="text-blue-400 hover:text-blue-300 break-all"
                      >
                        {channel.value}
                      </a>
                    ) : (
                      <span className="text-white break-all">{channel.value}</span>
                    )}
                    <div className="text-sm text-gray-500 mt-0.5">{channel.hint}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-600 mt-10">
          <Link href="/" className="hover:text-gray-400">
            ← На главную
          </Link>
        </p>
      </main>
    </div>
  );
}
