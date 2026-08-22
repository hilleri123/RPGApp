'use client';

import Header from '@/app/components/layout/Header';
import { ObserverRoomsPage } from '@/app/components/observer/ObserverRoomsPage';
import Link from 'next/link';

export default function ObserverCatalogPage() {
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
      <Header section="Наблюдение" />
      <main className="container mx-auto px-4 py-6 flex-1">
        <ObserverRoomsPage />
        <p className="text-center text-xs text-gray-600 mt-10">
          <Link href="/" className="hover:text-gray-400">
            ← На главную
          </Link>
        </p>
      </main>
    </div>
  );
}
