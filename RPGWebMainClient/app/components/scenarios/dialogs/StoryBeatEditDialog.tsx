'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';

import HtmlEditor from '@/app/components/common/HtmlEditor';
import RelationsTab from './common/RelationsTab';

import { useStoryBeatDialog } from '@/app/services/hooks/scenario/dialogs/useStoryBeatDialog';
import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useDialogMode } from './common/DialogModeContext';
import ValidationIssues from '../../rules/ValidationIssues';
import { SceneExposuresTab } from './common/SceneExposuresTab';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';

function StoryBeatMainTab({ dlg }: any) {
  const { readOnly } = useDialogMode();

  const n = dlg.form;

  const locationOptions = useMemo(
    () =>
      (dlg.lookups.locations ?? []).map((l: any) => ({
        id: String(l.id),
        name: l.name,
        tags: l.tags ?? [],
      })),
    [dlg.lookups.locations]
  );

  const npcOptions = useMemo(
    () =>
      (dlg.lookups.npcs ?? []).map((n2: any) => ({
        id: String(n2.id),
        name: n2.name,
        tags: n2.tags ?? [],
      })),
    [dlg.lookups.npcs]
  );

  const tags: string[] = dlg.form.tags ?? [];

  const toggleTag = (code: string) => {
    dlg.setForm((p: any) => {
      const prev: string[] = p.tags ?? [];
      const has = prev.includes(code);
      const next = has ? prev.filter((t) => t !== code) : [...prev, code];
      return {
        ...p,
        tags: next,
      };
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input
          placeholder="Название"
          value={n?.name ?? ''}
          disabled={readOnly}
          onChange={(e) => dlg.setForm((p: any) => ({ ...p, name: e.target.value }))}
        />
        <Input
          placeholder="Порядок"
          type="number"
          value={n?.order_num ?? 0}
          disabled={readOnly}
          onChange={(e) =>
            dlg.setForm((p: any) => ({
              ...p,
              order_num: Number(e.target.value),
            }))
          }
        />
        <Input
          placeholder="img_url"
          value={n?.img_url ?? ''}
          disabled={readOnly}
          onChange={(e) => {
            const v = e.target.value;
            dlg.setForm((p: any) => ({ ...p, img_url: v === '' ? null : v }));
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-xs text-gray-400">Текст для мастера</div>
          <HtmlEditor
            value={n?.text_for_master ?? ''}
            readOnly={readOnly}
            onChange={(html) =>
              dlg.setForm((p: any) => ({
                ...p,
                text_for_master: html === '' ? null : html,
              }))
            }
            placeholder="Текст для мастера"
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-400">Текст для игроков</div>
          <HtmlEditor
            value={n?.text_for_players ?? ''}
            readOnly={readOnly}
            onChange={(html) =>
              dlg.setForm((p: any) => ({
                ...p,
                text_for_players: html === '' ? null : html,
              }))
            }
            placeholder="Текст для игроков"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <input
            type="checkbox"
            className="rounded border-gray-600 bg-gray-900"
            disabled={readOnly}
            checked={tags.includes('use_once')}
            onChange={() => toggleTag('use_once')}
          />
          Показывать один раз
        </label>
      </div>

      <RelationsTab
        title="Локации"
        items={locationOptions}
        selectedIds={(n?.location_ids ?? []) as any}
        readOnly={readOnly}
        onChange={(ids) => {
          if (readOnly) return;
          dlg.setForm((p: any) => ({ ...p, location_ids: ids as any }));
        }}
        placeholder="Добавить локацию..."
      />

      <RelationsTab
        title="NPC"
        items={npcOptions}
        selectedIds={(n?.npc_ids ?? []) as any}
        readOnly={readOnly}
        onChange={(ids) => {
          if (readOnly) return;
          dlg.setForm((p: any) => ({ ...p, npc_ids: ids as any }));
        }}
        placeholder="Добавить NPC..."
      />
    </div>
  );
}

// function StoryBeatRulesTab({ dlg, pluginUI }: any) {
//   const { readOnly } = useDialogMode();

//   // у тебя было ObstacleDataEditor — оставляю как было
//   const Editor = pluginUI?.ObstacleDataEditor;
//   const View = pluginUI?.ObstacleDataView;

//   return (
//     <div className="space-y-3">
//       {readOnly ? (
//         View ? <View data={dlg.data} config={dlg.config} /> : <div className="text-gray-400 text-sm">Нет view для правил.</div>
//       ) : (
//         Editor && dlg.config ? (
//           <Editor data={dlg.data} config={dlg.config} issues={dlg.issues} onChange={dlg.setData} />
//         ) : (
//           <div className="text-gray-400 text-sm">Нет редактора правил или config не загрузился.</div>
//         )
//       )}
//       <ValidationIssues issues={dlg.issues} />
//     </div>
//   );
// }


function StoryBeatSceneTab({ dlg, scenarioId }: any) {
  const { readOnly } = useDialogMode();

  return (
    <SceneExposuresTab
      scenarioId={scenarioId}
      npcOptions={dlg.lookups.npcs}
      itemOptions={dlg.lookups.items}
      templateNpcOptions={dlg.lookups.template_npcs}
      templateItemOptions={dlg.lookups.template_items}
      audioOptions={dlg.lookups.audio_tracks}
      value={(dlg.form.scene_exposures ?? []) as any}
      readOnly={readOnly}
      onChange={(next: any) => {
        if (readOnly) return;
        dlg.setForm((p: any) => ({ ...p, scene_exposures: next as any }));
      }}
      config={dlg.configs["obstacle"]} 
    />
  );
}


export function StoryBeatEditDialog({
  open,
  onClose,
  editingId,
  onSave,
  onEntitySaved,
  readOnly = false,
}: EntityEditDealogProps) {
  const { scenarioId, pluginUI } = useScenario();

  const dlg = useStoryBeatDialog({
    open,
    scenarioId,
    storyBeatId: editingId,
    onSaved: async (id) => {
      await onEntitySaved?.(id);
      await onSave?.();
      onClose();
    },
  });

  const { footer, lineageDialog } = useLaunchedLineageExtras({
    editingId,
    entityType: 'story_beat',
    entityLabel: dlg.form?.name,
    readOnly,
  });

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'Сюжетный ход: редактирование' : 'Сюжетный ход: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={readOnly || !dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      footer={footer}
      tabs={[
        { key: 'main', title: 'Основное', content: <StoryBeatMainTab dlg={dlg} /> },
        { key: 'scene', title: 'Сцена', content: <StoryBeatSceneTab dlg={dlg} scenarioId={scenarioId} /> },
      ]}
      // rules={{
      //   content: <StoryBeatRulesTab dlg={dlg} pluginUI={pluginUI} />,
      //   onValidate: () => dlg.validate(),
      //   onForceSave: () => dlg.save(true),
      //   forceSaveDisabled: readOnly || (dlg.issues?.length ?? 0) === 0,
      //   loading: dlg.rulesLoading,
      // }}
    />
    {lineageDialog}
    </>
  );
}
