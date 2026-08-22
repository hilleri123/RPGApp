'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import HtmlEditor from '@/app/components/common/HtmlEditor';
import type { SessionDispatch } from '@/app/services/types/sessionDispatch';
import type { NoteCreate } from '@/app/services/types2';

export function SessionDispatchEditDialog({
  open,
  onClose,
  dispatch,
  note: noteProp,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  dispatch?: SessionDispatch | null;
  note?: NoteCreate & { id?: string } | null;
  onSave: (noteId: string, note: NoteCreate) => void;
}) {
  const sourceNote = dispatch?.note ?? noteProp;
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!sourceNote) return;
    setName(sourceNote.name ?? '');
    setText(sourceNote.text ?? '');
    setTags((sourceNote.tags ?? []).join(', '));
  }, [sourceNote]);

  const handleSave = () => {
    const noteId = dispatch?.note?.id ?? noteProp?.id;
    if (!noteId || !name.trim()) return;
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave(String(noteId), {
      name: name.trim(),
      text: text || null,
      tags: tagList.length ? tagList : sourceNote?.tags ?? [],
      allowed_character_shown_json: sourceNote?.allowed_character_shown_json ?? null,
      icon_url: sourceNote?.icon_url ?? null,
      img_url: sourceNote?.img_url ?? null,
      is_checked: (sourceNote as any)?.is_checked ?? false,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-gray-900 text-white border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle>Редактировать сообщение</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Заголовок"
            className="bg-gray-800 border-gray-600"
          />
          <div className="min-h-[120px]">
            <HtmlEditor
              value={text}
              onChange={setText}
              placeholder="Текст"
            />
          </div>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Теги через запятую"
            className="bg-gray-800 border-gray-600"
          />
          <p className="text-xs text-gray-500">
            После сохранения получатели увидят сообщение как новое непрочитанное.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
