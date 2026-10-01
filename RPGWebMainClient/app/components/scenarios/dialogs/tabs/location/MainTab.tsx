'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { EyeIcon, MapIcon } from 'lucide-react';
import HtmlEditor from '@/app/components/common/HtmlEditor';
import ImagePicker from '../../../../common/MapGallery';
import { EntityComboBox } from '../../common/EntityComboBox';
import { useDialogMode } from '../../common/DialogModeContext';
import { kindOfTags, withKind } from '@/app/lib/locationKinds';
import { LocationAncestry, LocationKindLadder } from '../../common/LocationKindLadder';
import type { LocationTabCommonProps } from './types';

export default function LocationMainTab({ dlg, editingId }: LocationTabCommonProps) {
  const { readOnly } = useDialogMode();

  const parentOptions = useMemo(
    () =>
      (dlg.lookups.locations ?? [])
        .filter((l: any) => !editingId || String(l.id) !== String(editingId))
        .map((l: any) => ({ id: String(l.id), name: l.name, tags: l.tags ?? [] })),
    [dlg.lookups.locations, editingId]
  );

  const mapSrc = dlg.assets.mapFile
    ? URL.createObjectURL(dlg.assets.mapFile)
    : dlg.form?.map_url || null;

  const iconSrc = dlg.assets.iconFile
    ? URL.createObjectURL(dlg.assets.iconFile)
    : dlg.form?.icon_url || null;

  const tags: string[] = dlg.form.tags ?? [];

  // Вид родительской локации ограничивает, какой вид можно дать этой локации.
  const parentKind = useMemo(() => {
    const pid = dlg.form.parent_location_id;
    if (!pid) return null;
    const parent = (dlg.lookups.locations ?? []).find((l: any) => String(l.id) === String(pid));
    return kindOfTags(parent?.tags)?.id ?? null;
  }, [dlg.form.parent_location_id, dlg.lookups.locations]);

  const currentKindId = kindOfTags(tags)?.id ?? null;

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
        {mapSrc ? <img src={mapSrc} alt="Карта локации" className="w-full h-full object-cover opacity-90" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {!readOnly && (
          <div className="absolute right-3 top-3">
            <ImagePicker
              icon={MapIcon}
              filter="map"
              title="Карта локации"
              buttonText="Карта"
              onSelect={async (url: string) => {
                dlg.setForm((p: any) => ({
                  ...p,
                  map_url: url === '' ? null : url,
                }));
                dlg.setAssets((a: any) => ({ ...a, mapFile: null }));
              }}
              onUpload={async (file: File) => {
                dlg.setAssets((a: any) => ({ ...a, mapFile: file }));
              }}
            />
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-start gap-3">
          <div className="relative">
            {iconSrc ? (
              <img
                src={iconSrc}
                alt="Иконка"
                className="w-14 h-14 rounded-md border border-gray-700 bg-gray-900 object-cover"
              />
            ) : null}

            {!readOnly && (
              <div className="absolute -right-2 -bottom-2">
                <ImagePicker
                  icon={EyeIcon}
                  filter="icon"
                  title="Иконка локации"
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
          <div className="text-white text-lg font-semibold">{dlg.form.name || 'Безымянная локация'}</div>
          {dlg.form.description_for_players ? (
            <div className="text-gray-200 text-sm line-clamp-2">{dlg.form.description_for_players}</div>
          ) : (
            <div className="text-gray-400 text-sm">Добавь описание для игроков.</div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Input
          placeholder="Имя"
          value={dlg.form.name ?? ''}
          disabled={readOnly}
          onChange={(e) => dlg.setForm((p: any) => ({ ...p, name: e.target.value }))}
        />

        <div>
          <div className="text-xs text-gray-400 mb-1">Родительская локация</div>
          <EntityComboBox
            value={(dlg.form.parent_location_id ?? null) as any}
            items={parentOptions}
            placeholder="—"
            readOnly={readOnly}
            onChange={(id) =>
              dlg.setForm((p: any) => ({ ...p, parent_location_id: id }))
            }
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-400">Вид и место в иерархии</div>
          <LocationAncestry
            locations={dlg.lookups.locations ?? []}
            parentId={dlg.form.parent_location_id}
            currentName={dlg.form.name ?? ''}
            currentKindId={currentKindId}
          />
          <LocationKindLadder
            value={currentKindId}
            parentKindId={parentKind}
            readOnly={readOnly}
            onChange={(kindId) => dlg.setForm((p: any) => ({ ...p, tags: withKind(p.tags, kindId) }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              className="rounded border-gray-600 bg-gray-900"
              disabled={readOnly}
              checked={tags.includes('start')}
              onChange={() => toggleTag('start')}
            />
            Стартовая
          </label>
          <label
            className="inline-flex items-center gap-2 text-sm text-white"
            title="Шаблонные локации показываются первыми в «Библиотеке локаций»"
          >
            <input
              type="checkbox"
              className="rounded border-gray-600 bg-gray-900"
              disabled={readOnly}
              checked={tags.includes('template')}
              onChange={() => toggleTag('template')}
            />
            Шаблон для библиотеки
          </label>
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
                description_for_master: html,
              }))
            }
          />
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
                description_for_players: html,
              }))
            }
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-400">Расширенное (URL)</summary>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input
              placeholder="icon_url"
              value={dlg.form.icon_url ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const v = e.target.value;
                dlg.setForm((p: any) => ({
                  ...p,
                  icon_url: v === '' ? null : v,
                }));
              }}
            />
            <Input
              placeholder="map_url"
              value={dlg.form.map_url ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const v = e.target.value;
                dlg.setForm((p: any) => ({
                  ...p,
                  map_url: v === '' ? null : v,
                }));
              }}
            />
          </div>
        </details>
      </div>
    </div>
  );
}