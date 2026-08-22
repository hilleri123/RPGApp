'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Save, Trash2, BookOpen, Eye, Pencil } from 'lucide-react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import { MASTER_NOTE_TAG } from '@/app/components/masterNotes/constants';
import { MasterNoteEditor } from '@/app/components/masterNotes/MasterNoteEditor';
import { MasterNoteContent } from '@/app/components/masterNotes/MasterNoteContent';
import { MasterNoteNavigationPanel } from '@/app/components/masterNotes/MasterNoteNavigationPanel';
import { WikiTreeList } from '@/app/components/masterNotes/WikiTreeList';
import { collectDescendantIds } from '@/app/components/masterNotes/wikiTree';
import { useWikiNotesScope } from '@/app/components/masterNotes/useWikiNotesScope';
import { useMasterNoteActions } from '@/app/components/masterNotes/useMasterNoteActions';
import { SessionEntityDialogs } from '@/app/components/session/common/SessionEntityDialogs';
import { ConfirmDialog } from '@/app/components/common/ConfirmDialog';
import { useMasterNoteNavigationStore } from '@/app/services/stores/masterNoteNavigation';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import type { FrontListItem } from '@/app/services/types2';

type WikiMode = 'view' | 'edit';

export type MasterNotesPanelProps = {
  /** When set, only show/create wiki pages belonging to this front. */
  lockedFrontId?: string | null;
  title?: string;
  compact?: boolean;
  readOnly?: boolean;
  /** Called after create/link/delete so parent (e.g. Front dialog) can refresh. */
  onFrontWikiChanged?: () => void;
  /** Bump to force reload of locked-front wiki membership. */
  wikiRefreshKey?: number;
};

export function MasterNotesPanel({
  lockedFrontId = null,
  title,
  compact = false,
  readOnly = false,
  onFrontWikiChanged,
  wikiRefreshKey = 0,
}: MasterNotesPanelProps = {}) {
  const scope = useWikiNotesScope();
  const masterNotes = scope?.masterNotes ?? [];
  const catalog = scope?.catalog ?? { npcs: [], items: [], characters: [], locations: [], notes: [] };
  const reloadNotes = scope?.reloadNotes ?? (() => {});
  const scenarioId = scope?.scenarioId ?? null;

  const wikiOpenNoteId = useMasterUiStore((s) => s.wikiOpenNoteId);
  const setWikiOpenNoteId = useMasterUiStore((s) => s.setWikiOpenNoteId);
  const wikiCreateRequest = useMasterUiStore((s) => s.wikiCreateRequest);
  const contentFrontId = useMasterUiStore((s) => s.contentFrontId);

  const filterFrontId = lockedFrontId ?? contentFrontId;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mode, setMode] = useState<WikiMode>('view');
  const [fronts, setFronts] = useState<FrontListItem[]>([]);
  const [frontWikiIds, setFrontWikiIds] = useState<Set<string> | null>(null);
  const [frontWikiTick, setFrontWikiTick] = useState(0);

  useEffect(() => {
    if (wikiRefreshKey > 0) setFrontWikiTick((t) => t + 1);
  }, [wikiRefreshKey]);

  const selected = useMemo(
    () => masterNotes.find((n) => n.id === selectedId) ?? null,
    [masterNotes, selectedId],
  );

  const openNote = useCallback((noteId: string) => {
    setSelectedId(noteId);
    setPendingParentId(null);
    setMode('view');
  }, []);

  const pushNav = useMasterNoteNavigationStore((s) => s.push);

  const { entityDialogs, navigateToEntry, followNoteLink, followEntityLink, editEntityLink } =
    useMasterNoteActions({ onOpenNote: openNote });

  const selectFromList = useCallback(
    (noteId: string, noteName: string) => {
      pushNav({ kind: 'note', id: noteId, name: noteName });
      openNote(noteId);
    },
    [pushNav, openNote],
  );

  const startNew = useCallback(
    (parentNoteId?: string | null) => {
      if (readOnly) return;
      setSelectedId(null);
      setPendingParentId(parentNoteId ? String(parentNoteId) : null);
      setName('');
      setText('');
      setMode('edit');
    },
    [readOnly],
  );

  useEffect(() => {
    if (!selected) return;
    setName(selected.name ?? '');
    setText(selected.text ?? '');
  }, [selected]);

  useEffect(() => {
    if (lockedFrontId) return;
    if (!wikiOpenNoteId) return;
    const note = masterNotes.find((n) => n.id === wikiOpenNoteId);
    if (note) selectFromList(note.id, note.name);
    setWikiOpenNoteId(null);
  }, [wikiOpenNoteId, masterNotes, selectFromList, setWikiOpenNoteId, lockedFrontId]);

  useEffect(() => {
    if (lockedFrontId || readOnly) return;
    if (wikiCreateRequest <= 0) return;
    startNew();
  }, [wikiCreateRequest, startNew, lockedFrontId, readOnly]);

  useEffect(() => {
    if (!scenarioId || lockedFrontId) return;
    const api = new ScenarioScopedApiService(scenarioId);
    void api.getFronts().then(setFronts).catch(() => setFronts([]));
  }, [scenarioId, lockedFrontId]);

  useEffect(() => {
    if (!scenarioId || !filterFrontId) {
      setFrontWikiIds(null);
      return;
    }
    const api = new ScenarioScopedApiService(scenarioId);
    void api
      .getFront(String(filterFrontId))
      .then((front) => {
        const linked = (front.wiki_notes ?? []).map((w) => String(w.note_id));
        const treeIds = (front.wiki_tree ?? []).map((n) => String(n.note_id));
        if (treeIds.length) {
          setFrontWikiIds(new Set(treeIds));
          return;
        }
        setFrontWikiIds(collectDescendantIds(masterNotes, linked));
      })
      .catch(() => setFrontWikiIds(null));
  }, [scenarioId, filterFrontId, masterNotes, frontWikiTick]);

  const refreshFrontWiki = useCallback(() => {
    setFrontWikiTick((t) => t + 1);
    onFrontWikiChanged?.();
  }, [onFrontWikiChanged]);

  const saveNote = async () => {
    if (!scenarioId || !name.trim() || readOnly) return;

    setSaving(true);
    try {
      const client = new ScenarioScopedApiService(scenarioId);

      if (selectedId && selected) {
        await client.updateNote(selectedId, {
          ...selected,
          name: name.trim(),
          text: text || null,
          tags: [MASTER_NOTE_TAG],
          parent_note_id: selected.parent_note_id ?? null,
          sort_order: selected.sort_order ?? 0,
        });
      } else {
        const siblings = masterNotes.filter(
          (n) => String(n.parent_note_id ?? '') === String(pendingParentId ?? ''),
        );
        const created = await client.createNote({
          name: name.trim(),
          text: text || null,
          tags: [MASTER_NOTE_TAG],
          allowed_character_shown_json: null,
          icon_url: null,
          img_url: null,
          parent_note_id: pendingParentId,
          sort_order: siblings.length,
        });

        if (lockedFrontId) {
          const parentInFront =
            pendingParentId && frontWikiIds?.has(String(pendingParentId));
          if (!parentInFront) {
            await client.linkFrontWikiNote(lockedFrontId, created.id);
          }
          refreshFrontWiki();
        }

        setSelectedId(created.id);
        setPendingParentId(null);
        pushNav({ kind: 'note', id: created.id, name: created.name });
        setMode('view');
      }
      reloadNotes();
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async () => {
    if (!selectedId || !selected || !scenarioId || readOnly) return;
    const client = new ScenarioScopedApiService(scenarioId);
    await client.deleteNote(selectedId);
    setSelectedId(null);
    setDeleteOpen(false);
    reloadNotes();
    if (lockedFrontId) refreshFrontWiki();
  };

  const reparentNote = useCallback(
    async (noteId: string, parentNoteId: string | null, sortOrder: number) => {
      if (!scenarioId || readOnly) return;
      const note = masterNotes.find((n) => String(n.id) === String(noteId));
      if (!note) return;
      const client = new ScenarioScopedApiService(scenarioId);
      await client.updateNote(noteId, {
        ...note,
        parent_note_id: parentNoteId,
        sort_order: sortOrder,
        tags: note.tags?.includes(MASTER_NOTE_TAG)
          ? note.tags
          : [...(note.tags ?? []), MASTER_NOTE_TAG],
      });
      reloadNotes();
      if (lockedFrontId) refreshFrontWiki();
    },
    [scenarioId, masterNotes, reloadNotes, readOnly, lockedFrontId, refreshFrontWiki],
  );

  const frontLabel = lockedFrontId
    ? null
    : fronts.find((f) => String(f.id) === String(contentFrontId))?.name;

  const panelTitle = title ?? (lockedFrontId ? 'Wiki фронта' : 'Wiki мастера');

  return (
    <div className={`flex flex-col min-h-0 gap-2 ${compact ? 'h-full' : 'h-full'}`}>
      <div className="flex items-center justify-between shrink-0 gap-2 flex-wrap">
        <span className="text-sm text-gray-300 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" /> {panelTitle}
          {frontLabel ? (
            <span className="text-[10px] text-violet-300/90 border border-violet-500/30 rounded px-1.5 py-0.5">
              фронт: {frontLabel}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === 'view' ? 'default' : 'outline'}
            className="h-7 px-2"
            onClick={() => setMode('view')}
            disabled={!selectedId}
          >
            <Eye className="w-3.5 h-3.5 mr-1" /> Просмотр
          </Button>
          {!readOnly ? (
            <>
              <Button
                size="sm"
                variant={mode === 'edit' ? 'default' : 'outline'}
                className="h-7 px-2"
                onClick={() => setMode('edit')}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" /> Правка
              </Button>
              <Button size="sm" variant="outline" onClick={() => startNew()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Новая
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className={`flex flex-1 gap-2 ${compact ? 'min-h-[320px]' : 'min-h-[280px]'}`}>
        <ScrollArea className="w-[28%] min-w-[88px] shrink-0 border border-gray-700 rounded-md">
          <WikiTreeList
            notes={masterNotes}
            selectedId={selectedId}
            onSelect={selectFromList}
            onReparent={readOnly ? undefined : reparentNote}
            onCreateChild={readOnly ? undefined : (parentId) => startNew(parentId)}
            filterIds={frontWikiIds}
          />
        </ScrollArea>

        <div className="flex-1 min-w-0 flex flex-col min-h-0 border border-gray-700 rounded-md p-2">
          {mode === 'edit' && !readOnly ? (
            <>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название заметки"
                className="mb-2 h-8 text-sm"
              />
              {pendingParentId && !selectedId ? (
                <div className="text-[10px] text-gray-500 mb-1">
                  Дочерняя для:{' '}
                  {masterNotes.find((n) => String(n.id) === pendingParentId)?.name ?? pendingParentId}
                </div>
              ) : null}
              <div className="flex-1 min-h-0 overflow-auto">
                <MasterNoteEditor
                  value={text}
                  onChange={setText}
                  catalog={catalog}
                  onNoteClick={followNoteLink}
                  onEntityInfo={followEntityLink}
                  onEntityEdit={editEntityLink}
                />
              </div>
              <div className="flex gap-2 mt-2 shrink-0">
                <Button size="sm" disabled={saving || !name.trim()} onClick={() => void saveNote()}>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {saving ? '…' : 'Сохранить'}
                </Button>
                {selectedId ? (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Удалить
                  </Button>
                ) : null}
              </div>
            </>
          ) : selected ? (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="text-base font-medium text-white mb-3">{selected.name}</div>
              <MasterNoteContent
                text={selected.text ?? ''}
                catalog={catalog}
                onNoteClick={followNoteLink}
                onEntityInfo={followEntityLink}
                onEntityEdit={editEntityLink}
              />
            </div>
          ) : (
            <div className="text-xs text-gray-500 p-2">Выберите заметку или создайте новую</div>
          )}
        </div>

        {!compact ? (
          <MasterNoteNavigationPanel
            className="w-[22%] min-w-[72px] shrink-0"
            onNavigate={navigateToEntry}
          />
        ) : null}
      </div>

      <SessionEntityDialogs {...entityDialogs} />

      <ConfirmDialog
        open={deleteOpen}
        title="Удалить wiki-заметку?"
        message={selected ? `«${selected.name}» будет удалена безвозвратно.` : 'Удалить заметку?'}
        onConfirm={() => void deleteNote()}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
