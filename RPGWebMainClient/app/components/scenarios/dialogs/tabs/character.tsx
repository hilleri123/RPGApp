'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserIcon, Plus } from 'lucide-react';

import HtmlEditor from '@/app/components/common/HtmlEditor';
import ImagePicker from '../../../common/MapGallery';
import ValidationIssues from '@/app/components/rules/ValidationIssues';
import { InventoryEditor } from '../common/InventoryEditor';
import { useDialogMode } from '../common/DialogModeContext';
import { RandomNamePicker } from '@/app/components/common/RandomNamePicker';
import { getNameGeneratorEntries } from '../common/nameGenerators';
import { GameItemEditDialog } from '../GameItemEditDialog';
import { useScenario } from '../../ScenarioContext';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { GameItemOut } from '@/app/services/types2';

const FALLBACK_AVATAR = 'https://rpgzona.ru/static/img/character-avatar-default.png';
const FALLBACK_ICON = 'https://rpgzona.ru/static/img/icon-default.png';

export type CharacterDlg = {
  form: any;
  assets: any;
  lookups: any;
  data: any;
  config: any;
  issues: any[];

  setForm?: (updater: any) => void;
  setAssets?: (updater: any) => void;
  setData?: (next: any) => void;
  reloadLookups?: () => Promise<void>;
};

export function CharacterMainTab({ dlg }: { dlg: CharacterDlg }) {
  const { readOnly } = useDialogMode();

  const avatarSrc = dlg.assets?.imgFile
    ? URL.createObjectURL(dlg.assets.imgFile)
    : dlg.form?.img_url || FALLBACK_AVATAR;

  const iconSrc = dlg.assets?.iconFile
    ? URL.createObjectURL(dlg.assets.iconFile)
    : dlg.form?.icon_url || FALLBACK_ICON;

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden bg-gray-950">
      <div className="relative h-56">
        <img src={avatarSrc} alt="Фото персонажа" className="w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {!readOnly && (
          <div className="absolute right-3 top-3">
            <ImagePicker
              icon={UserIcon}
              filter="image"
              title="Фото персонажа"
              buttonText="Фото"
              onSelect={async (url: string) => {
                dlg.setForm?.((p: any) => ({ ...p, img_url: url === '' ? null : url }));
                dlg.setAssets?.((a: any) => ({ ...a, imgFile: null }));
              }}
              onUpload={async (file: File) => {
                dlg.setAssets?.((a: any) => ({ ...a, imgFile: file }));
                dlg.setForm?.((p: any) => ({ ...p, img_url: null }));
              }}
            />
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-start gap-3">
          <div className="relative">
            <img
              src={iconSrc}
              alt="Иконка"
              className="w-14 h-14 rounded-md border border-gray-700 bg-gray-900 object-cover"
            />

            {!readOnly && (
              <div className="absolute -right-2 -bottom-2">
                <ImagePicker
                  icon={UserIcon}
                  filter="icon"
                  title="Иконка персонажа"
                  buttonText="Иконка"
                  onSelect={async (url: string) => {
                    dlg.setForm?.((p: any) => ({
                      ...p,
                      icon_url: url === '' ? null : url,
                    }));
                    dlg.setAssets?.((a: any) => ({ ...a, iconFile: null }));
                  }}
                  onUpload={async (file: File) => {
                    dlg.setAssets?.((a: any) => ({ ...a, iconFile: file }));
                    dlg.setForm?.((p: any) => ({ ...p, icon_url: null }));
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-3 bottom-3 right-3">
          <div className="text-white text-lg font-semibold">
            {dlg.form?.name || 'Безымянный персонаж'}
          </div>
          {dlg.form?.short_desc ? (
            <div className="text-gray-200 text-sm line-clamp-2">{dlg.form.short_desc}</div>
          ) : (
            <div className="text-gray-400 text-sm">Добавь короткое описание.</div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Имя"
              value={dlg.form?.name ?? ''}
              disabled={readOnly}
              className="flex-1"
              onChange={(e) =>
                dlg.setForm?.((p: any) => ({ ...p, name: e.target.value }))
              }
            />
            {!readOnly ? (
              <RandomNamePicker
                entries={dlg.nameGeneratorEntries ?? getNameGeneratorEntries(dlg.config)}
                entityKind="character"
                onSelect={({ name, tags: nameTags }) =>
                  dlg.setForm?.((p: any) => {
                    const prev: string[] = p.tags ?? [];
                    return { ...p, name, tags: Array.from(new Set([...prev, ...nameTags])) };
                  })
                }
              />
            ) : null}
          </div>
          <Input
            placeholder="Короткое описание"
            value={dlg.form?.short_desc ?? ''}
            disabled={readOnly}
            onChange={(e) =>
              dlg.setForm?.((p: any) => ({ ...p, short_desc: e.target.value }))
            }
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-1">История</div>
          <HtmlEditor
            placeholder="История"
            value={dlg.form?.story ?? ''}
            readOnly={readOnly}
            onChange={(html) =>
              dlg.setForm?.((p: any) => ({
                ...p,
                story: html === '' ? null : html,
              }))
            }
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-400">Расширенное (URL)</summary>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input
              placeholder="icon_url"
              value={dlg.form?.icon_url ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const v = e.target.value;
                dlg.setForm?.((p: any) => ({ ...p, icon_url: v === '' ? null : v }));
              }}
            />
            <Input
              placeholder="img_url"
              value={dlg.form?.img_url ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const v = e.target.value;
                dlg.setForm?.((p: any) => ({ ...p, img_url: v === '' ? null : v }));
              }}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

export function CharacterItemsTab({
  dlg,
  showTakeFromOtherOwner = true,
}: {
  dlg: CharacterDlg;
  showTakeFromOtherOwner?: boolean;
}) {
  const { readOnly } = useDialogMode();
  const { scenarioId } = useScenario();
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);

  const ownerId = dlg.form?.id ? String(dlg.form.id) : null;

  const handleItemCreated = useCallback(
    async (itemId: string) => {
      try {
        const full = await api.getItem(itemId);
        const out: GameItemOut = {
          id: full.id as any,
          name: full.name,
          description_for_master: full.description_for_master ?? null,
          description_for_players: full.description_for_players ?? null,
          icon_url: full.icon_url ?? null,
          img_url: full.img_url ?? null,
          owned_items: full.owned_items ?? [],
        };
        dlg.setForm?.((p: any) => {
          const prev = p.owned_items ?? [];
          if (prev.some((x: any) => String(x.id) === String(itemId))) return p;
          return { ...p, owned_items: [...prev, out] };
        });
        await dlg.reloadLookups?.();
      } catch {
        await dlg.reloadLookups?.();
      }
    },
    [api, dlg],
  );

  return (
    <div className="space-y-3">
      {!readOnly ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => setCreateItemOpen(true)}>
            <Plus className="w-4 h-4" />
            Создать предмет
          </Button>
        </div>
      ) : null}

      <InventoryEditor
        title="Предметы персонажа"
        currentOwner={ownerId ? { type: 'character', id: ownerId } : undefined}
        items={dlg.lookups?.items ?? []}
        value={dlg.form?.owned_items ?? []}
        onChange={(next) => {
          if (readOnly) return;
          dlg.setForm?.((p: any) => ({ ...p, owned_items: next }));
        }}
        onMarkTakeFromOtherOwner={
          showTakeFromOtherOwner
            ? (itemId) =>
                dlg.setForm?.((p: any) => ({
                  ...p,
                  take_from_other_owner_ids: Array.from(
                    new Set([...(p.take_from_other_owner_ids ?? []), String(itemId)]),
                  ),
                }))
            : undefined
        }
        onUnmarkTakeFromOtherOwner={
          showTakeFromOtherOwner
            ? (itemId) =>
                dlg.setForm?.((p: any) => ({
                  ...p,
                  take_from_other_owner_ids: (p.take_from_other_owner_ids ?? []).filter(
                    (x: any) => String(x) !== String(itemId),
                  ),
                }))
            : undefined
        }
        readOnly={readOnly}
      />
      <div className="text-xs text-gray-500">
        Связи владения сохраняются вместе с персонажем. Новый предмет можно создать кнопкой выше или выбрать из списка.
      </div>

      <GameItemEditDialog
        open={createItemOpen}
        onClose={() => setCreateItemOpen(false)}
        editingId={null}
        onEntitySaved={(id) => void handleItemCreated(id)}
      />
    </div>
  );
}

export type CharacterRulesMode = 'auto' | 'edit' | 'view';

export function CharacterRulesTab({
  dlg,
  pluginUI,
  rulesMode = 'auto',
}: {
  dlg: CharacterDlg;
  pluginUI: any;
  /** Явный режим: в диалогах редактирования передавайте `edit`, иначе View может включиться из-за readOnly в контексте. */
  rulesMode?: CharacterRulesMode;
}) {
  const { readOnly } = useDialogMode();

  const Editor = pluginUI?.CharacterDataEditor;
  const View = pluginUI?.CharacterDataView;

  const canEditRules =
    rulesMode === 'edit'
      ? typeof dlg.setData === 'function'
      : rulesMode === 'view'
        ? false
        : !readOnly && typeof dlg.setData === 'function';

  return (
    <div className="space-y-3">
      {canEditRules && Editor && dlg.config ? (
        <Editor data={dlg.data} config={dlg.config} issues={dlg.issues} onChange={dlg.setData} />
      ) : View && dlg.config ? (
        <View data={dlg.data} config={dlg.config} />
      ) : canEditRules ? (
        <div className="text-gray-400 text-sm">Нет редактора правил или config не загрузился.</div>
      ) : (
        <div className="text-gray-400 text-sm">Нет view для правил.</div>
      )}
      <ValidationIssues issues={dlg.issues} />
    </div>
  );
}
