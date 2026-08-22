// app/components/applications/tabs/ApplicationCommentTab.tsx
'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare } from 'lucide-react';

interface Props {
  value: string;
  readOnly?: boolean;
  onChange: (v: string) => void;
}

export function ApplicationCommentTab({ value, readOnly = false, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <MessageSquare className="w-4 h-4" />
        <span>Комментарий для мастера</span>
      </div>
      <Textarea
        placeholder="Что хотите сообщить мастеру? Пожелания, вопросы, договорённости..."
        value={value}
        disabled={readOnly}
        className="bg-gray-900 border-gray-700 text-white min-h-[160px] resize-none disabled:opacity-50"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-gray-600 text-xs">
        Мастер увидит этот комментарий при рассмотрении заявки.
      </p>
    </div>
  );
}