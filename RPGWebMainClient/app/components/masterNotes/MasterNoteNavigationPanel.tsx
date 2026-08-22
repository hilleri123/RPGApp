'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMasterNoteNavigationStore } from '@/app/services/stores/masterNoteNavigation';
import { LINK_KIND_LABELS } from '@/app/components/masterNotes/constants';
import type { MasterNoteNavEntry } from '@/app/components/masterNotes/types';

function entryLabel(entry: MasterNoteNavEntry): string {
  if (entry.kind === 'note') return entry.name;
  return `${LINK_KIND_LABELS[entry.entityKind]}: ${entry.name}`;
}

export function MasterNoteNavigationPanel({
  onNavigate,
  className = '',
}: {
  onNavigate: (entry: MasterNoteNavEntry) => void;
  className?: string;
}) {
  const stack = useMasterNoteNavigationStore((s) => s.stack);
  const index = useMasterNoteNavigationStore((s) => s.index);
  const back = useMasterNoteNavigationStore((s) => s.back);
  const forward = useMasterNoteNavigationStore((s) => s.forward);
  const goToIndex = useMasterNoteNavigationStore((s) => s.goToIndex);

  return (
    <div className={`flex flex-col min-h-0 border-l border-gray-700 pl-2 ${className}`}>
      <div className="flex items-center gap-1 mb-2 shrink-0">
        <History className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[10px] uppercase tracking-wide text-gray-500">История</span>
        <div className="ml-auto flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index <= 0}
            onClick={() => {
              const entry = back();
              if (entry) onNavigate(entry);
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index >= stack.length - 1}
            onClick={() => {
              const entry = forward();
              if (entry) onNavigate(entry);
            }}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-0.5 pr-1">
          {stack.length === 0 ? (
            <div className="text-[10px] text-gray-600 italic px-1">Переходы по ссылкам появятся здесь</div>
          ) : (
            stack.map((entry, i) => (
              <button
                key={`${entry.kind}-${entry.kind === 'note' ? entry.id : `${entry.entityKind}-${entry.id}`}-${i}`}
                type="button"
                className={`w-full text-left text-[11px] px-1.5 py-1 rounded truncate ${
                  i === index
                    ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
                onClick={() => {
                  goToIndex(i);
                  onNavigate(entry);
                }}
              >
                {entryLabel(entry)}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
