// dialogs/tabs/AddFromFactoryTab.tsx (фрагмент)
'use client';

import React, { useMemo, useState } from 'react';
import type { Factory } from '@/app/services/types2';
import type { FactoryPickKind } from '../AddToSceneDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { NpcRulesTab } from '@/app/components/scenarios/dialogs/tabs/npc';
import { GameItemRulesTab } from '@/app/components/scenarios/dialogs/tabs/item';
import { CharacterRulesTab } from '@/app/components/scenarios/dialogs/tabs/character';
import { DialogModeProvider } from '@/app/components/scenarios/dialogs/common/DialogModeContext';
// import { ItemRulesTab } from '...';
// import { CharacterRulesTab } from '...';

// --- превью справа, максимально похоже на NpcSessionEditDialog ---

export function FactoryPreviewPane({
  kind,
  item,
  pluginUI,
}: {
  kind: FactoryPickKind;
  item: any;
  pluginUI: any;
}) {
  const [tab, setTab] = useState<'main' | 'rules'>('main');

  // Для rules нам нужен "dlg"-подобный объект, хотя бы с form=data
  const fakeDlg = useMemo(
    () => ({
      form: item,
      assets: {},
      lookups: {},
      data: item?.data,
      config: {},
      issues: [],

      setForm: (updater: any) => {},
      setAssets: (updater: any) => {},
      setData: (next: any) => {},
    }),
    [item],
  );

  if (!item) {
    return (
      <div className="text-xs text-gray-500">
        Выбери объект слева, чтобы посмотреть детали.
      </div>
    );
  }
  
  const title =
    item.name ||
    (kind === 'character' && item.short_desc) ||
    '(без имени)';

  return (
    <DialogModeProvider readOnly={true}>
      <div className="flex flex-col h-full">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold text-sm">
            {title}{' '}
            <span className="text-xs text-gray-500">[{kind}]</span>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mb-2">
            <TabsTrigger value="main">Основное</TabsTrigger>
            <TabsTrigger value="rules">Правила</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-1">
            <TabsContent value="main" className="space-y-3">
              {kind === 'npc' && (
                <div className="space-y-3 text-xs text-gray-300">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Имя</div>
                    <div className="px-2 py-1 rounded bg-gray-900 border border-gray-800">
                      {item.name || <span className="text-gray-500">(без имени)</span>}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      Описание для мастера
                    </div>
                    <div
                      className="prose prose-invert max-w-none text-xs border border-gray-800 rounded px-2 py-1 bg-gray-900"
                      dangerouslySetInnerHTML={{
                        __html: item.description_for_master || '',
                      }}
                    />
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      Описание для игроков
                    </div>
                    <div
                      className="prose prose-invert max-w-none text-xs border border-gray-800 rounded px-2 py-1 bg-gray-900"
                      dangerouslySetInnerHTML={{
                        __html: item.description_for_players || '',
                      }}
                    />
                  </div>
                </div>
              )}

              {kind === 'item' && (
                <div className="space-y-3 text-xs text-gray-300">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Имя</div>
                    <div className="px-2 py-1 rounded bg-gray-900 border border-gray-800">
                      {item.name || <span className="text-gray-500">(без имени)</span>}
                    </div>
                  </div>

                  {/* сюда аналогично можешь вывести описания / данные предмета */}
                </div>
              )}

              {kind === 'character' && (
                <div className="space-y-3 text-xs text-gray-300">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Имя</div>
                    <div className="px-2 py-1 rounded bg-gray-900 border border-gray-800">
                      {item.name || <span className="text-gray-500">(без имени)</span>}
                    </div>
                  </div>

                  {item.short_desc && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Кратко</div>
                      <div className="px-2 py-1 rounded bg-gray-900 border border-gray-800">
                        {item.short_desc}
                      </div>
                    </div>
                  )}

                  {item.story && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">История</div>
                      <div
                        className="prose prose-invert max-w-none text-xs border border-gray-800 rounded px-2 py-1 bg-gray-900"
                        dangerouslySetInnerHTML={{
                          __html: item.story || '',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rules" className="space-y-2 text-xs">
              {/* тупо тот же компонент, что в диалоге, только без кнопок */}
              {kind === 'npc' && <NpcRulesTab dlg={fakeDlg} pluginUI={pluginUI} />}
              {kind === 'item' && <GameItemRulesTab dlg={fakeDlg} pluginUI={pluginUI} />}
              {kind === 'character' && (
                <CharacterRulesTab dlg={fakeDlg} pluginUI={pluginUI} rulesMode="view" />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DialogModeProvider>
  );
}
