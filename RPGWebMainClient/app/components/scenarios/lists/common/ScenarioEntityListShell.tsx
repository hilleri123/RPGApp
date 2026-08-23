// app/components/scenarios/lists/common/ScenarioEntityListShell.tsx
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, CopyPlus } from 'lucide-react';
import { ConfirmAlertDialog } from '@/app/components/common/ConfirmAlertDialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  EntityTagFilterChips,
  collectTagKeysFromItems,
  entityHasAllTags,
} from '../../dialogs/common/EntityTagFilterChips';

export type OpenMode = 'view' | 'edit';
export type OpenParams<T> = { item: T | null; mode: OpenMode };

export type ScenarioEntityListShellProps<T extends { id: string }> = {
  title: string;
  loading: boolean;
  error?: string | null;
  items: T[];

  refetch: () => unknown | Promise<unknown>;
  onDelete?: (item: T) => unknown | Promise<unknown>;

  renderCard: (p: {
    item: T;
    onOpen: (mode: OpenMode) => void;
    onDelete?: () => void;
    readOnly: boolean;
  }) => React.ReactNode;

  renderDialog: (p: {
    open: boolean;
    editingId: string | null;
    templatePackId: string | null;
    readOnly: boolean;
    onClose: () => void;
    onSaved: () => void;
  }) => React.ReactNode;

  getDeleteTitle?: (item: T) => string;
  getDeleteDescription?: (item: T) => string;
  /** Если false — кнопка удаления скрыта (например, lineage-объект в launched). */
  canDelete?: (item: T) => boolean;

  templatesToggle?: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    labels?: { scenario?: string; templates?: string };
  };

  customFilters?: React.ReactNode;
  readOnly?: boolean;
  onImportExisting?: () => void;
  importExistingLabel?: string;
  onCreateFromTemplate?: () => void;
  createFromTemplateLabel?: string;
  getTemplatePackId?: (item: T) => string | null | undefined;
  /** Extract tags for list filtering. Default: item.tags */
  getItemTags?: (item: T) => string[] | null | undefined;
  availableTags?: string[];
};

export function ScenarioEntityListShell<T extends { id: string }>(props: ScenarioEntityListShellProps<T>) {
  const {
    title,
    loading,
    error,
    items,
    refetch,
    onDelete,
    renderCard,
    renderDialog,
    getDeleteTitle,
    getDeleteDescription,
    canDelete,
    templatesToggle,
    customFilters,
    readOnly = false,
    onImportExisting,
    importExistingLabel = 'Добавить существующий',
    onCreateFromTemplate,
    createFromTemplateLabel = 'Создать из шаблона',
    getTemplatePackId,
    getItemTags,
    availableTags,
  } = props;

  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgReadOnly, setDlgReadOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templatePackId, setTemplatePackId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [nameFilter, setNameFilter] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const resolveTags = useCallback(
    (item: T) => {
      if (getItemTags) return getItemTags(item) ?? [];
      return ((item as any)?.tags as string[] | undefined) ?? [];
    },
    [getItemTags],
  );

  const tagOptions = useMemo(() => {
    const fromItems = items.map((it) => ({ tags: resolveTags(it) }));
    return collectTagKeysFromItems(fromItems, availableTags);
  }, [items, availableTags, resolveTags]);

  const openDialog = useCallback((p: OpenParams<T>) => {
    setEditingId(p.item?.id ?? null);
    setTemplatePackId(p.item ? (getTemplatePackId?.(p.item) ?? null) : null);
    setDlgReadOnly(p.mode === 'view');
    setDlgOpen(true);
  }, [getTemplatePackId]);

  const closeDialog = useCallback(() => {
    setDlgOpen(false);
    setEditingId(null);
    setTemplatePackId(null);
    setDlgReadOnly(false);
  }, []);

  const onSaved = useCallback(() => {
    void refetch();
  }, [refetch]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !onDelete) return;

    const target = deleteTarget;
    setDeleteTarget(null);
    setDeleting(true);

    try {
      await onDelete(target);
      void refetch();
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onDelete, refetch]);

  const filteredItems = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return items.filter((it) => {
      if (!entityHasAllTags(resolveTags(it), activeTags)) return false;
      if (!q) return true;
      return ((it as any)?.name ?? '').toLowerCase().includes(q);
    });
  }, [items, nameFilter, activeTags, resolveTags]);

  const grid = useMemo(() => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((it) =>
          renderCard({
            item: it,
            onOpen: (mode) => openDialog({ item: it, mode: readOnly ? 'view' : mode }),
            onDelete: readOnly || !onDelete || (canDelete && !canDelete(it)) ? undefined : () => setDeleteTarget(it),
            readOnly,
          }),
        )}
      </div>
    );
  }, [filteredItems, renderCard, onDelete, canDelete, openDialog, readOnly]);

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin" /></div>;

  const deleteName = deleteTarget
    ? (getDeleteTitle ? getDeleteTitle(deleteTarget) : (deleteTarget as any).name ?? String(deleteTarget.id))
    : '';

  const deleteDescription = deleteTarget && getDeleteDescription
    ? getDeleteDescription(deleteTarget)
    : `Действительно хотите удалить “${deleteName}”? Это действие нельзя отменить.`;

  const scenarioLabel = templatesToggle?.labels?.scenario ?? 'Сценарий';
  const templatesLabel = templatesToggle?.labels?.templates ?? 'Шаблоны';
  const hasActiveFilters = Boolean(nameFilter) || activeTags.length > 0;

  return (
    <div className="space-y-4 text-white">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>

          {templatesToggle ? (
            <div className="flex items-center gap-2 text-sm">
              <span className={!templatesToggle.checked ? 'text-white' : 'text-gray-400'}>{scenarioLabel}</span>
              <Switch checked={templatesToggle.checked} onCheckedChange={templatesToggle.onCheckedChange} />
              <span className={templatesToggle.checked ? 'text-white' : 'text-gray-400'}>{templatesLabel}</span>
            </div>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="flex gap-2">
            {onImportExisting ? (
              <Button type="button" variant="secondary" onClick={onImportExisting}>
                {importExistingLabel}
              </Button>
            ) : null}
            {onCreateFromTemplate ? (
              <Button type="button" variant="secondary" onClick={onCreateFromTemplate}>
                <CopyPlus className="mr-2 h-4 w-4" /> {createFromTemplateLabel}
              </Button>
            ) : null}
            <Button onClick={() => openDialog({ item: null, mode: 'edit' })}>
              <Plus className="mr-2" /> Создать
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Поиск по имени..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-56"
        />
        {customFilters}
        {hasActiveFilters && !customFilters && (
          <button
            type="button"
            onClick={() => {
              setNameFilter('');
              setActiveTags([]);
            }}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-gray-700"
          >
            сбросить
          </button>
        )}
      </div>

      {tagOptions.length > 0 ? (
        <EntityTagFilterChips options={tagOptions} value={activeTags} onChange={setActiveTags} size="sm" />
      ) : null}

      {error ? <div className="text-red-500 text-sm">{error}</div> : null}

      {grid}

      {renderDialog({
        open: dlgOpen,
        editingId,
        templatePackId,
        readOnly: dlgReadOnly,
        onClose: closeDialog,
        onSaved,
      })}

      {deleteTarget && (
        <ConfirmAlertDialog
          open
          onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
          description={<>{deleteDescription}</>}
          loading={deleting}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
