'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { ScenarioTag } from '@/app/services/types2';
import { useScenario } from '../ScenarioContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ScenarioTagsPanel() {
  const { scenarioId, canEditEntities } = useScenario();
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);
  const [tags, setTags] = useState<ScenarioTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#a78bfa');

  const reload = async () => {
    setLoading(true);
    try {
      setTags(await api.getScenarioTags());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  const create = async () => {
    if (!key.trim() && !label.trim()) return;
    await api.createScenarioTag({
      key: key.trim() || label.trim(),
      label: label.trim() || key.trim(),
      description: description.trim() || null,
      color,
      kind: 'manual',
    });
    setKey('');
    setLabel('');
    setDescription('');
    await reload();
  };

  const remove = async (id: string, kind: string) => {
    if (kind === 'front') return;
    await api.deleteScenarioTag(id);
    await reload();
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">Пул тэгов</h2>
        <p className="text-xs text-gray-500 mt-1">
          Тэги сценария с описаниями для мастера. Игрокам не показываются. Тэги фронтов создаются автоматически.
        </p>
      </div>

      {canEditEntities ? (
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-gray-400">
            key
            <Input className="mt-1 w-32" value={key} onChange={(e) => setKey(e.target.value)} placeholder="rome" />
          </label>
          <label className="text-xs text-gray-400">
            Название
            <Input className="mt-1 w-40" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Рим" />
          </label>
          <label className="text-xs text-gray-400 flex-1 min-w-[12rem]">
            Описание (tooltip)
            <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 rounded border border-zinc-700" />
          <Button type="button" onClick={() => void create()}>Добавить</Button>
          <Button type="button" variant="secondary" onClick={() => void api.importScenarioTagsFromEntities().then(reload)}>
            Импорт с сущностей
          </Button>
        </div>
      ) : null}

      {loading ? <div className="text-sm text-gray-500">Загрузка…</div> : null}

      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                  style={{
                    borderColor: t.color || '#52525b',
                    backgroundColor: `${t.color || '#52525b'}22`,
                  }}
                >
                  <span className="font-mono text-gray-300">{t.key}</span>
                  <span className="text-gray-400">{t.label}</span>
                  {t.kind === 'front' ? (
                    <span className="text-[10px] uppercase text-violet-300">front</span>
                  ) : null}
                  {canEditEntities && t.kind !== 'front' ? (
                    <button
                      type="button"
                      className="text-gray-500 hover:text-red-300 ml-1"
                      onClick={() => void remove(t.id, t.kind)}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t.description || 'Без описания'}
              </TooltipContent>
            </Tooltip>
          ))}
          {!loading && !tags.length ? (
            <span className="text-xs text-gray-500">Пул пуст</span>
          ) : null}
        </div>
      </TooltipProvider>
    </div>
  );
}
