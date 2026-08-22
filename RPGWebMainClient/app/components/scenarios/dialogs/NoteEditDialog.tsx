'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { StickyNoteIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

import HtmlEditor from '@/app/components/common/HtmlEditor';
import ImagePicker from '../../common/MapGallery';
import RelationsTab from '@/app/components/scenarios/dialogs/common/RelationsTab';

import { useNoteDialog } from '@/app/services/hooks/scenario/dialogs/useNoteDialog';
import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useDialogMode } from './common/DialogModeContext';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';


const FALLBACK_IMG = 'https://rpgzona.ru/static/img/note-default.png';
const FALLBACK_ICON = 'https://rpgzona.ru/static/img/icon-default.png';

export function NoteMainTab({ dlg }: any) {
  const { readOnly } = useDialogMode();

  const imgSrc = dlg.form.img_url ? dlg.form.img_url : FALLBACK_IMG;
  const iconSrc = dlg.form.icon_url ? dlg.form.icon_url : FALLBACK_ICON;

  const TASK_TAG = 'task';

  function toggleTag(prevTags: any, tag: string, checked: boolean) {
    const arr = Array.isArray(prevTags) ? prevTags.map(String) : [];
    const has = arr.includes(tag);
    if (checked && !has) return [...arr, tag];
    if (!checked && has) return arr.filter((t) => t !== tag);
    return arr;
  }

  const tags = Array.isArray(dlg.form.tags) ? dlg.form.tags.map(String) : [];
  const isTask = tags.includes(TASK_TAG);

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden bg-gray-950">
      <div className="relative h-56">
        <img src={imgSrc} alt="Изображение заметки" className="w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {!readOnly && (
          <div className="absolute right-3 top-3">
            <ImagePicker
              icon={StickyNoteIcon}
              filter="image"
              title="Картинка заметки"
              buttonText="Картинка"
              onSelect={async (url: string) => {
                dlg.setForm((p: any) => ({ ...p, img_url: url === '' ? null : url }));
              }}
              onUpload={async (_file: File) => {
                // notes upload пока не поддерживаем
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
                  icon={StickyNoteIcon}
                  filter="icon"
                  title="Иконка заметки"
                  buttonText="Иконка"
                  onSelect={async (url: string) => {
                    dlg.setForm((p: any) => ({ ...p, icon_url: url === '' ? null : url }));
                  }}
                  onUpload={async (_file: File) => {
                    // notes upload пока не поддерживаем
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-3 bottom-3 right-3">
          <div className="text-white text-lg font-semibold">{dlg.form.name || 'Безымянная заметка'}</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Input
          placeholder="Название"
          value={dlg.form.name ?? ''}
          disabled={readOnly}
          onChange={(e) => dlg.setForm((p: any) => ({ ...p, name: e.target.value }))}
        />

        <div className="flex items-center gap-2">
          <Checkbox
            checked={isTask}
            disabled={readOnly}
            onCheckedChange={(v) => {
              if (readOnly) return;
              const checked = v === true; // shadcn может вернуть 'indeterminate'
              dlg.setForm((p: any) => ({
                ...p,
                tags: toggleTag(p.tags, TASK_TAG, checked),
              }));
            }}
          />
          <div className="text-sm text-gray-200">Это задача (tag: task)</div>
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-1">Текст</div>
          <HtmlEditor
            placeholder="Текст заметки"
            value={dlg.form.text ?? ''}
            readOnly={readOnly}
            onChange={(html) => dlg.setForm((p: any) => ({ ...p, text: html === '' ? null : html }))}
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
                dlg.setForm((p: any) => ({ ...p, icon_url: v === '' ? null : v }));
              }}
            />
            <Input
              placeholder="img_url"
              value={dlg.form.img_url ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const v = e.target.value;
                dlg.setForm((p: any) => ({ ...p, img_url: v === '' ? null : v }));
              }}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

export function NoteLinksTab({ dlg }: any) {
  const { readOnly } = useDialogMode();

  const charOptions = useMemo(
    () =>
      (dlg.lookups.characters ?? []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
        tags: c.tags ?? [],
      })),
    [dlg.lookups.characters]
  );

  return (
    <div className="space-y-3">
      <RelationsTab
        title="Кому показывать"
        items={charOptions}
        selectedIds={(dlg.form.allowed_character_shown_json ?? []) as any}
        readOnly={readOnly}
        onChange={(ids) => {
          if (readOnly) return;
          dlg.setForm((p: any) => ({ ...p, allowed_character_shown_json: ids as any }));
        }}
        placeholder="Выбрать персонажей..."
      />
      <div className="text-xs text-gray-500">Сохраняется в allowed_character_shown_json.</div>
    </div>
  );
}

export function NoteEditDialog({
  open,
  onClose,
  editingId,
  onSave,
  onEntitySaved,
  readOnly = false,
}: EntityEditDealogProps) {
  const { scenarioId } = useScenario();

  const dlg = useNoteDialog({
    open,
    scenarioId,
    noteId: editingId,
    onSaved: (id) => {
      onEntitySaved?.(id);
      onSave?.();
      onClose();
    },
  });

  const { footer, lineageDialog } = useLaunchedLineageExtras({
    editingId,
    entityType: 'note',
    entityLabel: dlg.form?.name,
    readOnly,
  });

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'Заметка: редактирование' : 'Заметка: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={!dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      footer={footer}
      tabs={[
        { key: 'main', title: 'Текст', content: <NoteMainTab dlg={dlg} /> },
        { key: 'links', title: 'Доступ', content: <NoteLinksTab dlg={dlg} /> },
      ]}
    />
    {lineageDialog}
    </>
  );
}
