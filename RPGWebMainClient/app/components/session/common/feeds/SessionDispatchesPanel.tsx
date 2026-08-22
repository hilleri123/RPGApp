'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BaseFeedRow } from '@/app/components/common/BaseFeedRow';
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import { SessionDispatch } from '@/app/services/types/sessionDispatch';
import { NoteShownModal } from '@/app/components/session/common/notifications/NoteShownModal';
import { NoteShownNotification } from '@/app/services/types/session.notification';
import { usePlayerSessionWebSocket } from '@/app/services/hooks/usePlayerSessionWebSocket';
import { Send } from 'lucide-react';

const PLAYER_TAG_PRESETS = ['действие', 'вопрос', 'заметка', 'task'];

function dispatchToNotif(d: SessionDispatch): NoteShownNotification {
  return {
    id: d.id,
    dt: d.sent_at,
    notif_type: 'note_shown',
    initiator_id: d.sender_id,
    recipients: d.recipient_user_ids,
    readed_by: [],
    note: d.note,
  };
}

export function SessionDispatchesPanel({ sessionId }: { sessionId: string }) {
  const common = useCommonSessionWebSocket(sessionId) as any;
  const player = usePlayerSessionWebSocket(sessionId);

  const list = (common.dispatches ?? []) as SessionDispatch[];
  const isMaster = common.isMaster;
  const isPlayer = !isMaster;

  const [active, setActive] = useState<SessionDispatch | null>(null);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');

  const sorted = useMemo(
    () => [...list].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1)),
    [list],
  );

  const sendPlayer = () => {
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (!name.trim() || tagList.length === 0) return;
    player.dispatchNote({
      name: name.trim(),
      text: text || null,
      tags: tagList,
      allowed_character_shown_json: null,
      icon_url: null,
      img_url: null,
    }, [], true);
    setName('');
    setText('');
    setTags('');
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-[120px]">
      <div className="overflow-y-auto max-h-80 bg-gray-950 rounded p-2 space-y-1 text-sm flex-1">
        {sorted.map((d) => (
          <BaseFeedRow key={d.id} id={d.id} dt={d.sent_at}>
            <button
              type="button"
              className="text-left w-full rounded px-2 py-1.5 hover:bg-gray-800 border-l-2 border-violet-500/40"
              onClick={() => setActive(d)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white">{d.note.name}</span>
                <span className="text-[10px] text-gray-500">
                  {d.sender_name ?? d.sender_role} · {d.sender_role === 'master' ? 'мастер' : 'игрок'}
                </span>
                {d.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] py-0">
                    {t}
                  </Badge>
                ))}
              </div>
              {d.note.text ? (
                <div
                  className="text-xs text-gray-400 line-clamp-2 mt-0.5 prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: d.note.text }}
                />
              ) : null}
            </button>
          </BaseFeedRow>
        ))}
        {sorted.length === 0 ? (
          <div className="text-xs text-gray-500 italic px-2 py-1">Записок пока нет</div>
        ) : null}
      </div>

      {isPlayer ? (
        <div className="border border-gray-700 rounded p-2 space-y-2 shrink-0">
          <div className="text-xs text-gray-400">Новая записка (теги обязательны)</div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Заголовок"
            className="h-8 text-sm"
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Текст"
            className="min-h-[60px] text-sm"
          />
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Теги через запятую"
            className="h-8 text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {PLAYER_TAG_PRESETS.map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                className="h-6 text-[10px]"
                onClick={() => setTags((prev) => (prev ? `${prev}, ${t}` : t))}
              >
                +{t}
              </Button>
            ))}
          </div>
          <Button size="sm" disabled={!name.trim() || !tags.trim()} onClick={sendPlayer}>
            <Send className="w-3.5 h-3.5 mr-1" /> Отправить мастеру
          </Button>
        </div>
      ) : null}

      {isMaster ? (
        <div className="text-[10px] text-gray-500 px-1">
          Чтобы разослать записку игрокам — откройте заметку в разделе «Заметки» → вкладка «Показать».
        </div>
      ) : null}

      {active ? (
        <NoteShownModal
          open
          onClose={() => setActive(null)}
          notif={dispatchToNotif(active)}
          sessionId={sessionId}
          initiatorName={active.sender_name ?? active.sender_id}
        />
      ) : null}
    </div>
  );
}
