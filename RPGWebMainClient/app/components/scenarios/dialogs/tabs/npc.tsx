'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, PersonStanding } from 'lucide-react';
import { Input } from '@/components/ui/input';

import HtmlEditor from '@/app/components/common/HtmlEditor';
import { InventoryEditor } from '../common/InventoryEditor';
import ImagePicker from '@/app/components/common/MapGallery';
import { useDialogMode } from '../common/DialogModeContext';
import ValidationIssues from '@/app/components/rules/ValidationIssues';
import { RandomNamePicker } from '@/app/components/common/RandomNamePicker';
import { getNameGeneratorEntries } from '../common/nameGenerators';
import { ScenarioTagPicker } from '../common/ScenarioTagPicker';
import { useScenario } from '@/app/components/scenarios/ScenarioContext';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

const FALLBACK_AVATAR = 'https://rpgzona.ru/static/img/npc-avatar-default.png';
const FALLBACK_ICON = 'https://rpgzona.ru/static/img/icon-default.png';

export function NpcMainTab({ dlg }: any) {
  const { readOnly } = useDialogMode();
  const { scenarioId } = useScenario();
  const [poolKeys, setPoolKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!scenarioId) return;
    const api = new ScenarioScopedApiService(scenarioId);
    void api.getScenarioTags().then((tags) => setPoolKeys(new Set(tags.map((t) => t.key))));
  }, [scenarioId]);

  const avatarSrc = dlg.assets.imgFile ? URL.createObjectURL(dlg.assets.imgFile) : dlg.form.img_url || FALLBACK_AVATAR;
  const iconSrc = dlg.assets.iconFile ? URL.createObjectURL(dlg.assets.iconFile) : dlg.form.icon_url || FALLBACK_ICON;

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
    <div className="rounded-lg border border-gray-700 overflow-hidden bg-gray-950">
      <div className="relative h-56">
        <img src={avatarSrc} alt="Фото NPC" className="w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {!readOnly && (
          <div className="absolute right-3 top-3">
            <ImagePicker
              icon={PersonStanding}
              filter="image"
              title="Фото NPC"
              buttonText="Фото"
              onSelect={async (url: string) => {
                dlg.setForm((p: any) => ({ ...p, img_url: url === '' ? null : url }));
                dlg.setAssets((a: any) => ({ ...a, imgFile: null }));
              }}
              onUpload={async (file: File) => dlg.setAssets((a: any) => ({ ...a, imgFile: file }))}
            />
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-start gap-3">
          <div className="relative">
            <img src={iconSrc} alt="Иконка" className="w-14 h-14 rounded-md border border-gray-700 bg-gray-900 object-cover" />
            {!readOnly && (
              <div className="absolute -right-2 -bottom-2">
                <ImagePicker
                  icon={PersonStanding}
                  filter="icon"
                  title="Иконка NPC"
                  buttonText="Иконка"
                  onSelect={async (url: string) => {
                    dlg.setForm((p: any) => ({ ...p, icon_url: url === '' ? null : url }));
                    dlg.setAssets((a: any) => ({ ...a, iconFile: null }));
                  }}
                  onUpload={async (file: File) => dlg.setAssets((a: any) => ({ ...a, iconFile: file }))}
                />
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-3 bottom-3 right-3">
          <div className="text-white text-lg font-semibold">{dlg.form.name || 'Безымянный NPC'}</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Имя"
            value={dlg.form.name ?? ''}
            disabled={readOnly}
            className="flex-1"
            onChange={(e) => dlg.setForm((p: any) => ({ ...p, name: e.target.value }))}
          />
          {!readOnly ? (
            <RandomNamePicker
              entries={dlg.nameGeneratorEntries ?? getNameGeneratorEntries(dlg.config)}
              entityKind="npc"
              onSelect={({ name, tags: nameTags }) => {
                dlg.setForm((p: any) => {
                  const prev: string[] = p.tags ?? [];
                  const allowed = nameTags.filter((t) => poolKeys.has(t));
                  const merged = Array.from(new Set([...prev, ...allowed]));
                  return { ...p, name, tags: merged };
                });
              }}
            />
          ) : null}
        </div>

        {/* Блок тегов */}
        <div>
          <div className="text-xs text-gray-400 mb-1">Системные теги</div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-200">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-gray-600 bg-gray-900"
                disabled={readOnly}
                checked={tags.includes('enemy')}
                onChange={() => toggleTag('enemy')}
              />
              <span>Враг</span>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-gray-600 bg-gray-900"
                disabled={readOnly}
                checked={tags.includes('campaign_skip')}
                onChange={() => toggleTag('campaign_skip')}
              />
              <span>Не переносить в кампании</span>
            </label>
          </div>
          {scenarioId ? (
            <ScenarioTagPicker
              className="mt-3"
              scenarioId={scenarioId}
              value={tags}
              readOnly={readOnly}
              onChange={(next) => dlg.setForm((p: any) => ({ ...p, tags: next }))}
            />
          ) : null}
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-1">Описание (игроки)</div>
          <HtmlEditor
            placeholder="Описание (игроки)"
            value={dlg.form.description_for_players ?? ''}
            readOnly={readOnly}
            onChange={(html) =>
              dlg.setForm((p: any) => ({
                ...p,
                description_for_players: html === '' ? null : html,
              }))
            }
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-1">Описание (мастер)</div>
          <HtmlEditor
            placeholder="Описание (мастер)"
            value={dlg.form.description_for_master ?? ''}
            readOnly={readOnly}
            onChange={(html) =>
              dlg.setForm((p: any) => ({
                ...p,
                description_for_master: html === '' ? null : html,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}

export function NpcItemsTab({ dlg }: any) {
  const { readOnly } = useDialogMode();

  // ВАЖНО: передаём полный объект с owner, а не {id,name}
  const itemsWithOwner = useMemo(() => dlg.lookups.items ?? [], [dlg.lookups.items]);

  return (
    <div className="space-y-3">
      <InventoryEditor
        title="Предметы NPC"
        currentOwner={{ type: 'npc', id: dlg.form.id! }}
        items={itemsWithOwner}
        value={dlg.form.owned_items ?? []}
        onChange={(next) => dlg.setForm((p: any) => ({ ...p, owned_items: next }))}
        onMarkTakeFromOtherOwner={(itemId) =>
          dlg.setForm((p: any) => ({
            ...p,
            take_from_other_owner_ids: Array.from(new Set([...(p.take_from_other_owner_ids ?? []), String(itemId)])),
          }))
        }
        onUnmarkTakeFromOtherOwner={(itemId) =>
          dlg.setForm((p: any) => ({
            ...p,
            take_from_other_owner_ids: (p.take_from_other_owner_ids ?? []).filter(
              (x: any) => String(x) !== String(itemId)
            ),
          }))
        }
        readOnly={readOnly}
      />

      <div className="text-xs text-gray-500">
        Тут сохраняются связи владения (owned_items). Сами предметы создаются в редакторе предметов.
      </div>
    </div>
  );
}

export function NpcRulesTab({ dlg, pluginUI }: any) {
  const { readOnly } = useDialogMode();
  const Editor = pluginUI?.NPCDataEditor;
  const View = pluginUI?.NPCDataView;
  const rulesLoading = !!dlg.rulesLoading;
  const hasConfig = dlg.config != null;

  return (
    <div className="space-y-3">
      {rulesLoading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Загрузка редактора правил…
        </div>
      ) : readOnly ? (
        View && hasConfig ? (
          <View data={dlg.data} config={dlg.config} />
        ) : (
          <div className="text-gray-400 text-sm">Нет view для правил.</div>
        )
      ) : Editor ? (
        <Editor
          data={dlg.data}
          config={dlg.config ?? {}}
          issues={dlg.issues}
          onChange={dlg.setData}
        />
      ) : (
        <div className="text-gray-400 text-sm">
          {hasConfig
            ? 'Нет редактора правил для выбранной системы.'
            : 'Не удалось загрузить конфигурацию редактора правил. Обновите страницу или проверьте вход в аккаунт.'}
        </div>
      )}
      {dlg.error ? <div className="text-red-400 text-sm">{String(dlg.error)}</div> : null}
      <ValidationIssues issues={dlg.issues} />
    </div>
  );
}
