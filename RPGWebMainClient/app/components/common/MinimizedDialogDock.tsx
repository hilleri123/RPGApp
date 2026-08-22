'use client';

import { X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMinimizedDialogsStore } from '@/app/services/stores/minimizedDialogs';

export function MinimizedDialogDock() {
  const items = useMinimizedDialogsStore((s) => s.items);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[70] pointer-events-none flex justify-start px-3 pb-2 gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-center gap-1 rounded-t-lg border border-gray-600 border-b-0 bg-gray-900 shadow-xl max-w-[280px]"
        >
          <button
            type="button"
            className="flex-1 min-w-0 px-3 py-2 text-left text-sm text-white truncate hover:bg-gray-800 rounded-tl-lg"
            onClick={item.onRestore}
            title="Развернуть"
          >
            {item.title}
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-gray-400 hover:text-white"
            onClick={item.onRestore}
            title="Развернуть"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-400 rounded-tr-lg"
            onClick={item.onClose}
            title="Закрыть"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
