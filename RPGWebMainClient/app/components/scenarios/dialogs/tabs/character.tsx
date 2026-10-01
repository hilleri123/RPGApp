'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserIcon, Plus, CopyPlus, Loader2 } from 'lucide-react';

import HtmlEditor from '@/app/components/common/HtmlEditor';
import ImagePicker from '../../../common/MapGallery';
import ValidationIssues from '@/app/components/rules/ValidationIssues';
import { InventoryEditor } from '../common/InventoryEditor';
import { useDialogMode } from '../common/DialogModeContext';
import { RandomNamePicker } from '@/app/components/common/RandomNamePicker';
import { getNameGeneratorEntries } from '../common/nameGenerators';
import { GameItemEditDialog } from '../GameItemEditDialog';
import { CreateItemFromTemplatePickerDialog } from '../CreateItemFromTemplatePickerDialog';
import { CounterEditDialog } from '../CounterEditDialog';
import { ScenarioCounterCard } from '../../cards/CounterCard';
import { ConfirmAlertDialog } from '@/app/components/common/ConfirmAlertDialog';
import { useScenario, useScenarioOptional } from '../../ScenarioContext';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { GameItemTemplateSeed } from '@/app/services/hooks/scenario/dialogs/useGameItemDialog';
import type { Counter, GameItemOut } from '@/app/services/types2';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';

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
  // В шаблонах паков нет сценария: предметы создаются/правятся отдельно, а здесь только выбираются.
  const scenarioCtx = useScenarioOptional();
  const scenarioId = scenarioCtx?.scenarioId ?? null;
  const scenario = scenarioCtx?.scenario ?? null;
  const canManageItems = Boolean(scenarioId);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [seedFromTemplate, setSeedFromTemplate] = useState<GameItemTemplateSeed | null>(null);
  const [editItem, setEditItem] = useState<{ id: string; viewOnly: boolean } | null>(null);
  const api = useMemo(() => (scenarioId ? new ScenarioScopedApiService(scenarioId) : null), [scenarioId]);

  const ownerId = dlg.form?.id ? String(dlg.form.id) : null;

  const handleItemCreated = useCallback(
    async (itemId: string) => {
      if (!api) return;
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
          // уже в инвентаре (после правки предмета) — обновляем карточку на месте
          if (prev.some((x: any) => String(x.id) === String(itemId))) {
            return { ...p, owned_items: prev.map((x: any) => (String(x.id) === String(itemId) ? out : x)) };
          }
          return { ...p, owned_items: [...prev, out] };
        });
        await dlg.reloadLookups?.();
      } catch {
        await dlg.reloadLookups?.();
      }
    },
    [api, dlg],
  );

  const openBlankCreate = () => {
    setSeedFromTemplate(null);
    setCreateItemOpen(true);
  };

  return (
    <div className="space-y-3">
      {!readOnly && canManageItems ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setTemplatePickerOpen(true)}
          >
            <CopyPlus className="w-4 h-4" />
            Создать из шаблона
          </Button>
          <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={openBlankCreate}>
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
        onEditItem={canManageItems ? (id, viewOnly) => setEditItem({ id, viewOnly }) : undefined}
        readOnly={readOnly}
      />
      <div className="text-xs text-gray-500">
        {canManageItems
          ? 'Связи владения сохраняются вместе с персонажем. Новый предмет можно создать кнопками выше или выбрать из списка.'
          : 'Предметы выбираются из шаблонов пака; создавать и править их нужно на вкладке предметов пака.'}
      </div>

      {canManageItems && scenarioId ? (
        <>
        <CreateItemFromTemplatePickerDialog
          open={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
          scenarioId={scenarioId}
          defaultPackId={scenario?.template_set_id}
          onPick={(pick) => {
            setSeedFromTemplate({ templateId: pick.templateId, packId: pick.packId });
            setCreateItemOpen(true);
          }}
        />

        <GameItemEditDialog
          open={createItemOpen}
          onClose={() => {
            setCreateItemOpen(false);
            setSeedFromTemplate(null);
          }}
          editingId={null}
          seedFromTemplate={seedFromTemplate}
          onEntitySaved={(id) => void handleItemCreated(id)}
        />

        <GameItemEditDialog
          open={editItem !== null}
          onClose={() => setEditItem(null)}
          editingId={editItem?.id ?? null}
          readOnly={editItem?.viewOnly ?? false}
          onEntitySaved={(id) => void handleItemCreated(id)}
        />
        </>
      ) : null}
    </div>
  );
}

export function CharacterCountersTab({ characterId }: { characterId: string }) {
  const { readOnly } = useDialogMode();
  const { scenarioId, scenario } = useScenario();
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);

  const [items, setItems] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgReadOnly, setDlgReadOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Counter | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.getCounters();
      setItems(
        (rows ?? []).filter((c) => String(c.character_id ?? '') === String(characterId)),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить счётчики');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api, characterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = () => {
    setEditingId(null);
    setDlgReadOnly(false);
    setDlgOpen(true);
  };

  const openEdit = (counter: Counter, viewOnly: boolean) => {
    setEditingId(String(counter.id));
    setDlgReadOnly(viewOnly || readOnly);
    setDlgOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteCounter(String(deleteTarget.id));
      setDeleteTarget(null);
      await reload();
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось удалить счётчик');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {!readOnly ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Создать счётчик
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Загрузка счётчиков…
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-400">{error}</div> : null}

      {!loading && items.length === 0 ? (
        <div className="text-xs text-gray-500">
          У этого персонажа пока нет счётчиков. Создайте новый кнопкой выше.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((counter) => (
            <ScenarioCounterCard
              key={String(counter.id)}
              counter={counter}
              readOnly={readOnly}
              onEdit={(c, ro) => openEdit(c, ro)}
              onDelete={
                readOnly || isLineageProtectedEntity(scenario, counter)
                  ? undefined
                  : (c) => setDeleteTarget(c)
              }
              onChanged={() => void reload()}
            />
          ))}
        </div>
      )}

      <CounterEditDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        editingId={editingId}
        readOnly={dlgReadOnly}
        lockedCharacterId={characterId}
        onSave={() => void reload()}
      />

      {deleteTarget ? (
        <ConfirmAlertDialog
          open
          onOpenChange={(v) => {
            if (!v && !deleting) setDeleteTarget(null);
          }}
          description={
            <>Удалить счётчик “{deleteTarget.name}”? Это действие нельзя отменить.</>
          }
          loading={deleting}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
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
