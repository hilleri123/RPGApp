'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { PackageIcon } from 'lucide-react';

import HtmlEditor from '@/app/components/common/HtmlEditor';
import ImagePicker from '../../../common/MapGallery';
import { InventoryEditor } from '../common/InventoryEditor';
import ValidationIssues from '../../../rules/ValidationIssues';
import { useDialogMode } from '../common/DialogModeContext';
import { RandomNamePicker } from '@/app/components/common/RandomNamePicker';
import { getNameGeneratorEntries } from '../common/nameGenerators';

const FALLBACK_IMG = 'https://rpgzona.ru/static/img/item-default.png';
const FALLBACK_ICON = 'https://rpgzona.ru/static/img/icon-default.png';

export type ItemDlg = {
  form: any;
  assets: any;
  lookups: any;
  data: any;
  config: any;
  issues: any[];

  setForm: (updater: any) => void;
  setAssets: (updater: any) => void;
  setData: (next: any) => void;
};

export function GameItemMainTab({ dlg }: { dlg: ItemDlg }) {
  const { readOnly } = useDialogMode();

  const imgSrc = dlg.assets?.imgFile
    ? URL.createObjectURL(dlg.assets.imgFile)
    : dlg.form?.img_url || FALLBACK_IMG;

  const iconSrc = dlg.assets?.iconFile
    ? URL.createObjectURL(dlg.assets.iconFile)
    : dlg.form?.icon_url || FALLBACK_ICON;

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden bg-gray-950">
      <div className="relative h-56">
        <img src={imgSrc} alt="Изображение предмета" className="w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {!readOnly && (
          <div className="absolute right-3 top-3">
            <ImagePicker
              icon={PackageIcon}
              filter="image"
              title="Изображение предмета"
              buttonText="Картинка"
              onSelect={async (url: string) => {
                dlg.setForm((p: any) => ({
                  ...p,
                  img_url: url === '' ? null : url,
                }));
                dlg.setAssets((a: any) => ({ ...a, imgFile: null }));
              }}
              onUpload={async (file: File) => {
                dlg.setAssets((a: any) => ({ ...a, imgFile: file }));
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
                  icon={PackageIcon}
                  filter="icon"
                  title="Иконка предмета"
                  buttonText="Иконка"
                  onSelect={async (url: string) => {
                    dlg.setForm((p: any) => ({
                      ...p,
                      icon_url: url === '' ? null : url,
                    }));
                    dlg.setAssets((a: any) => ({ ...a, iconFile: null }));
                  }}
                  onUpload={async (file: File) => {
                    dlg.setAssets((a: any) => ({ ...a, iconFile: file }));
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-3 bottom-3 right-3">
          <div className="text-white text-lg font-semibold">{dlg.form?.name || 'Безымянный предмет'}</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Имя"
            value={dlg.form?.name ?? ''}
            disabled={readOnly}
            className="flex-1"
            onChange={(e) =>
              dlg.setForm((p: any) => ({ ...p, name: e.target.value }))
            }
          />
          {!readOnly ? (
            <RandomNamePicker
              entries={getNameGeneratorEntries(dlg.config)}
              entityKind="item"
              onSelect={({ name, tags: nameTags }) =>
                dlg.setForm((p: any) => {
                  const prev: string[] = p.tags ?? [];
                  return { ...p, name, tags: Array.from(new Set([...prev, ...nameTags])) };
                })
              }
            />
          ) : null}
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-1">Описание (игроки)</div>
          <HtmlEditor
            placeholder="Описание (игроки)"
            value={dlg.form?.description_for_players ?? ''}
            readOnly={readOnly}
            onChange={(html) =>
              dlg.setForm((p: any) => ({
                ...p,
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
            value={dlg.form?.description_for_master ?? ''}
            readOnly={readOnly}
            onChange={(html) =>
              dlg.setForm((p: any) => ({
                ...p,
                ...p,
                description_for_master: html === '' ? null : html,
              }))
            }
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer select-none text-gray-300 hover:text-white">
            Quest badge (HTML)
          </summary>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Left: editor */}
            <div className="rounded border border-gray-700 bg-black/30 p-2">
              <div className="text-xs text-gray-400 mb-2">HTML код (quest_html_mark)</div>

              <textarea
                className="w-full min-h-[140px] rounded border border-gray-700 bg-gray-950 px-2 py-2 text-xs font-mono text-gray-100 outline-none focus:ring-1 focus:ring-blue-500/40"
                placeholder={`Напр.: <span class="...">!</span> или <img src="...">`}
                value={dlg.form?.quest_html_mark ?? ''}
                disabled={readOnly}
                onChange={(e) =>
                  dlg.setForm((p: any) => ({
                    ...p,
                    ...p,
                    quest_html_mark: e.target.value === '' ? null : e.target.value,
                  }))
                }
              />
            </div>

            {/* Right: previews */}
            <div className="rounded border border-gray-700 bg-black/30 p-2">
              <div className="text-xs text-gray-400 mb-2">Превью</div>

              <div className="flex items-start gap-3">
                {/* small 4x4 */}
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] text-gray-500">Маленькая (4×4)</div>
                  <div className="w-4 h-4 rounded border border-gray-700 bg-gray-950 flex items-center justify-center overflow-hidden">
                    <span
                      className="block"
                      style={{
                        width: 4,
                        height: 4,
                        transform: 'scale(0.125)',        // 4px -> 32px scale; чтобы html обычно “влез”
                        transformOrigin: 'top left',
                      }}
                      dangerouslySetInnerHTML={{ __html: dlg.form?.quest_html_mark ?? '' }}
                    />
                  </div>
                </div>

                {/* big 32x32 */}
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] text-gray-500">Большая (32×32)</div>
                  <div className="w-8 h-8 rounded border border-gray-700 bg-gray-950 flex items-center justify-center overflow-hidden">
                    <span
                      className="block"
                      dangerouslySetInnerHTML={{ __html: dlg.form?.quest_html_mark ?? '' }}
                    />
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 mt-3">
                Совет: делай бейдж размером ~32×32 (svg/img/span), маленькая версия просто масштабируется.
              </div>
            </div>
          </div>
        </details>

      </div>
    </div>
  );
}

export function GameItemItemsTab({
  dlg,
  title = 'Содержимое',
}: {
  dlg: ItemDlg;
  title?: string;
}) {
  const { readOnly } = useDialogMode();

  const itemOptions = useMemo(
    () =>
      (dlg.lookups?.items ?? []).map((i: any) => ({
        id: String(i.id),
        name: i.name,
        tags: i.tags ?? [],
      })),
    [dlg.lookups?.items],
  );

  const value = (dlg.form?.contained_items ?? []) as any;

  return (
    <div className="space-y-3">
      <InventoryEditor
        title={title}
        items={itemOptions}
        value={value}
        onChange={(next) => {
          if (readOnly) return;
          dlg.setForm((p: any) => ({ ...p, ["contained_items"]: next as any }));
        }}
        readOnly={readOnly}
      />
    </div>
  );
}

export function GameItemRulesTab({ dlg, pluginUI }: { dlg: ItemDlg; pluginUI: any }) {
  const { readOnly } = useDialogMode();

  const Editor = pluginUI?.ItemDataEditor;
  const View = pluginUI?.ItemDataView;

  return (
    <div className="space-y-3">
      {readOnly ? (
        View ? (
          <View data={dlg.data} config={dlg.config} issues={dlg.issues} />
        ) : (
          <div className="text-gray-400 text-sm">Нет view для правил.</div>
        )
      ) : Editor && dlg.config ? (
        <Editor data={dlg.data} config={dlg.config} issues={dlg.issues} onChange={dlg.setData} />
      ) : (
        <div className="text-gray-400 text-sm">Нет редактора правил или config не загрузился.</div>
      )}
      <ValidationIssues issues={dlg.issues} />
    </div>
  );
}
