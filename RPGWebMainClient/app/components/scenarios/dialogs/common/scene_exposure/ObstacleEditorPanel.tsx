'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import HtmlEditor from '@/app/components/common/HtmlEditor';
import ValidationIssues from '@/app/components/rules/ValidationIssues';
import { useScenario } from '../../../ScenarioContext';
import { useSceneExposures } from './SceneExposuresContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const OBSTACLE_HIDDEN_TAG = 'hidden';

export function ObstacleEditorPanel(props: { config?: any; onBack?: () => void }) {
  const { pluginUI } = useScenario();
  const { readOnly, editingObstacleIdx, currentObstacle, patchObstacleAt, removeObstacleAt } =
    useSceneExposures();

  const ObstacleEditor = pluginUI?.ObstacleDataEditor;
  const ObstacleView = pluginUI?.ObstacleDataView;

  if (editingObstacleIdx == null) return null;
  if (!currentObstacle) return <div className="text-sm text-gray-400">Не найдено.</div>;

  const tags: string[] = currentObstacle.tags ?? [];
  const isHidden = tags.includes(OBSTACLE_HIDDEN_TAG);

  const toggleHidden = () => {
    if (readOnly) return;
    const prev = currentObstacle.tags ?? [];
    const has = prev.includes(OBSTACLE_HIDDEN_TAG);
    const next = has
      ? prev.filter((t) => t !== OBSTACLE_HIDDEN_TAG)
      : [...prev, OBSTACLE_HIDDEN_TAG];
    patchObstacleAt(editingObstacleIdx, { tags: next });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Редактор препятствия</span>

            {/* Индикатор / тоггл тега hidden */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleHidden}
                  disabled={readOnly}
                  className={cn(
                    'rounded border px-2 py-0.5 text-[11px] font-medium transition-colors',
                    isHidden
                      ? 'border-transparent text-white bg-amber-600'
                      : 'border-gray-600 text-gray-400 bg-transparent hover:border-gray-400',
                  )}
                >
                  Скрытое
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  {isHidden
                    ? 'Убрать тег: препятствие видно игрокам'
                    : 'Добавить тег: препятствие скрыто от игроков'}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={readOnly}
              onClick={() => removeObstacleAt(editingObstacleIdx)}
            >
              Удалить
            </Button>

            <Button type="button" variant="secondary" onClick={props.onBack}>
              Назад к списку
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-gray-700 bg-gray-950 p-3 space-y-2">
          <div className="text-xs text-gray-400">Нарратив</div>

          <Input
            placeholder="Название"
            value={currentObstacle.name ?? ''}
            disabled={readOnly}
            onChange={(e) => patchObstacleAt(editingObstacleIdx, { name: e.target.value })}
          />

          <div>
            <div className="text-xs text-gray-400 mb-1">Описание (игроки)</div>
            <HtmlEditor
              value={currentObstacle.description_for_players ?? ''}
              readOnly={readOnly}
              onChange={(html) =>
                patchObstacleAt(editingObstacleIdx, {
                  description_for_players: html === '' ? null : html,
                })
              }
              placeholder="Описание (игроки)"
            />
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Описание (мастер)</div>
            <HtmlEditor
              value={currentObstacle.description_for_master ?? ''}
              readOnly={readOnly}
              onChange={(html) =>
                patchObstacleAt(editingObstacleIdx, {
                  description_for_master: html === '' ? null : html,
                })
              }
              placeholder="Описание (мастер)"
            />
          </div>
        </div>

        <div className="rounded-md border border-gray-700 bg-gray-950 p-3 space-y-2">
          <div className="text-xs text-gray-400">Правила (плагин)</div>

          {ObstacleEditor ? (
            readOnly ? (
              ObstacleView ? (
                <ObstacleView data={currentObstacle.data} config={props.config} />
              ) : (
                <div className="text-sm text-gray-400">Нет view для препятствий.</div>
              )
            ) : (
              <ObstacleEditor
                data={currentObstacle.data ?? {}}
                config={props.config}
                issues={[]}
                onChange={(nextData: any) =>
                  patchObstacleAt(editingObstacleIdx, { data: nextData })
                }
              />
            )
          ) : (
            <div className="text-sm text-gray-400">
              Плагин не дал ObstacleDataEditor.
            </div>
          )}

          <ValidationIssues issues={[]} />
        </div>
      </div>
    </TooltipProvider>
  );
}
