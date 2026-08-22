'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type {
  Front,
  FrontEntityType,
  FrontListItem,
  NPCList,
  GameItemList,
  StoryBeatList,
  Counter,
} from '@/app/services/types2';
import { useScenario } from '../ScenarioContext';
import { MASTER_NOTE_TAG } from '@/app/components/masterNotes/constants';
import { MasterNotesPanel } from '@/app/components/masterNotes/MasterNotesPanel';
import { ScenarioMasterNotesProvider } from '@/app/components/masterNotes/ScenarioMasterNotesProvider';
import ImagePicker from '@/app/components/common/MapGallery';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { EntityComboBox, type IdName } from '../dialogs/common/EntityComboBox';
import { NpcEditDialog } from '../dialogs/NpcEditDialog';
import { StoryBeatEditDialog } from '../dialogs/StoryBeatEditDialog';
import { GameItemEditDialog } from '../dialogs/GameItemEditDialog';
import { CounterEditDialog } from '../dialogs/CounterEditDialog';
import { ConfirmAlertDialog } from '@/app/components/common/ConfirmAlertDialog';

type UiEntityType = Exclude<FrontEntityType, 'location'>;

const ENTITY_LABELS: Record<UiEntityType, string> = {
  npc: 'NPC',
  story_beat: 'Сюжет',
  item: 'Предмет',
  counter: 'Счётчик',
};

type Catalog = {
  npc: Array<IdName & { raw?: NPCList }>;
  story_beat: Array<IdName & { raw?: StoryBeatList }>;
  item: Array<IdName & { raw?: GameItemList }>;
  counter: Array<IdName & { raw?: Counter }>;
};

type NestedCreate =
  | { kind: UiEntityType; mode: 'create' | 'edit'; id: string | null }
  | null;

export function FrontEditDialog({
  open,
  onClose,
  editingId,
  readOnly,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const { scenarioId } = useScenario();
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);

  const [loading, setLoading] = useState(false);
  const [front, setFront] = useState<Front | null>(null);
  const [frontId, setFrontId] = useState<string | null>(editingId);
  const [tab, setTab] = useState('general');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<Catalog>({
    npc: [],
    story_beat: [],
    item: [],
    counter: [],
  });
  const [pickByType, setPickByType] = useState<Record<UiEntityType, string | null>>({
    npc: null,
    story_beat: null,
    item: null,
    counter: null,
  });
  const [pickNoteId, setPickNoteId] = useState<string | null>(null);
  const [wikiLinkOptions, setWikiLinkOptions] = useState<IdName[]>([]);
  const [wikiRefreshKey, setWikiRefreshKey] = useState(0);
  const [nested, setNested] = useState<NestedCreate>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Entity type to bind to this front after a successful create. */
  const pendingBindRef = useRef<UiEntityType | null>(null);

  const openCreate = (entityType: UiEntityType) => {
    pendingBindRef.current = entityType;
    setNested({ kind: entityType, mode: 'create', id: null });
  };

  const openEdit = (entityType: UiEntityType, entityId: string) => {
    pendingBindRef.current = null;
    setNested({ kind: entityType, mode: 'edit', id: entityId });
  };

  const closeNested = () => {
    pendingBindRef.current = null;
    setNested(null);
  };

  const reloadCatalog = useCallback(async () => {
    const [npcs, items, beats, counters, notes] = await Promise.all([
      api.getNpcs(),
      api.getItemsWithOwner(),
      api.getStoryBeats(),
      api.getCounters(),
      api.getNotes(),
    ]);
    setCatalog({
      npc: (npcs as NPCList[]).map((x) => ({
        id: String(x.id),
        name: x.name,
        tags: x.tags ?? [],
        raw: x,
      })),
      item: (items as GameItemList[]).map((x) => ({
        id: String(x.id),
        name: x.name,
        tags: (x as any).tags ?? [],
        raw: x,
      })),
      story_beat: (beats as StoryBeatList[]).map((x) => ({
        id: String(x.id),
        name: x.name,
        tags: x.tags ?? [],
        raw: x,
      })),
      counter: (counters as Counter[]).map((x) => ({
        id: String(x.id),
        name: x.name,
        tags: x.tags ?? [],
        raw: x,
      })),
    });
    const masterNotes = (notes as { id: string; name: string; tags?: string[] }[]).filter((n) =>
      (n.tags ?? []).includes(MASTER_NOTE_TAG),
    );
    setWikiLinkOptions(
      masterNotes.map((n) => ({ id: String(n.id), name: n.name, tags: n.tags ?? [] })),
    );
  }, [api]);

  const reloadFront = useCallback(
    async (id: string) => {
      const f = await api.getFront(id);
      setFront(f);
      setFrontId(String(f.id));
      setName(f.name);
      setDescription(f.description_for_master ?? '');
      setColor(f.color || '#7c3aed');
      setIconUrl(f.icon_url ?? null);
      return f;
    },
    [api],
  );

  useEffect(() => {
    if (!open) {
      pendingBindRef.current = null;
      setNested(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setTab('general');
      setNested(null);
      try {
        await reloadCatalog();
        if (cancelled) return;
        if (editingId) {
          await reloadFront(editingId);
        } else {
          setFront(null);
          setFrontId(null);
          setName('');
          setDescription('');
          setColor('#7c3aed');
          setIconUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editingId, reloadCatalog, reloadFront]);

  const memberName = (entityType: string, entityId: string) => {
    const list = catalog[entityType as UiEntityType];
    return list?.find((o) => o.id === String(entityId))?.name ?? entityId;
  };

  const handleSaveMeta = async () => {
    if (readOnly || !name.trim()) return;
    setLoading(true);
    try {
      if (frontId) {
        const updated = await api.updateFront(frontId, {
          name: name.trim(),
          description_for_master: description || null,
          color,
          icon_url: iconUrl,
        });
        setFront(updated);
        onSaved?.();
        onClose();
      } else {
        const created = await api.createFront({
          name: name.trim(),
          description_for_master: description || null,
          color,
          icon_url: iconUrl,
        });
        setFront(created);
        setFrontId(String(created.id));
        onSaved?.();
        // Keep dialog open after create so member/wiki tabs become available.
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFront = async () => {
    if (!frontId || readOnly) return;
    await api.deleteFront(frontId);
    setConfirmDelete(false);
    onSaved?.();
    onClose();
  };

  const handleAddMember = async (entityType: UiEntityType) => {
    if (!frontId || readOnly) return;
    const entityId = pickByType[entityType];
    if (!entityId) return;
    const updated = await api.addFrontMember(frontId, entityType, entityId);
    setFront(updated);
    setPickByType((p) => ({ ...p, [entityType]: null }));
    onSaved?.();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!frontId || readOnly) return;
    const updated = await api.removeFrontMember(frontId, memberId);
    setFront(updated);
    onSaved?.();
  };

  const handleLinkWiki = async () => {
    if (!frontId || !pickNoteId || readOnly) return;
    const updated = await api.linkFrontWikiNote(frontId, pickNoteId);
    setFront(updated);
    setPickNoteId(null);
    setWikiRefreshKey((k) => k + 1);
    onSaved?.();
  };

  const afterEntityCreated = async (entityType: UiEntityType, entityId: string) => {
    if (!frontId) return;
    const id = String(entityId || '').trim();
    if (!id || id === 'null' || id === 'undefined') {
      console.warn('Front bind skipped: missing entity id', entityType, entityId);
      return;
    }
    const updated = await api.addFrontMember(frontId, entityType, id);
    setFront(updated);
    await reloadCatalog();
    onSaved?.();
  };

  const handleEntitySavedFromNested = async (entityType: UiEntityType, entityId: string) => {
    const shouldBind = pendingBindRef.current === entityType;
    pendingBindRef.current = null;
    if (shouldBind) {
      await afterEntityCreated(entityType, entityId);
    } else {
      await reloadCatalog();
      onSaved?.();
    }
  };

  const membersOf = (entityType: UiEntityType) =>
    (front?.members ?? []).filter((m) => m.entity_type === entityType);

  const linkableOf = (entityType: UiEntityType) => {
    const taken = new Set(membersOf(entityType).map((m) => String(m.entity_id)));
    return catalog[entityType].filter((o) => !taken.has(o.id));
  };

  const linkedNoteIds = new Set((front?.wiki_notes ?? []).map((w) => String(w.note_id)));
  const linkableNotes = wikiLinkOptions.filter((n) => !linkedNoteIds.has(String(n.id)));

  const renderMemberTab = (entityType: UiEntityType) => {
    const members = membersOf(entityType);
    return (
      <div className="space-y-3 pt-3">
        <ul className="space-y-1 text-sm">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-2 py-1.5"
            >
              <button
                type="button"
                className="text-left text-violet-200 hover:underline truncate"
                onClick={() => openEdit(entityType, String(m.entity_id))}
              >
                {memberName(entityType, String(m.entity_id))}
              </button>
              {!readOnly && (
                <Button type="button" size="sm" variant="ghost" onClick={() => void handleRemoveMember(m.id)}>
                  Убрать
                </Button>
              )}
            </li>
          ))}
          {!members.length ? <li className="text-xs text-gray-500">Пока пусто</li> : null}
        </ul>

        {!readOnly && frontId ? (
          <div className="flex flex-wrap gap-2 items-start">
            <div className="flex-1 min-w-[12rem]">
              <EntityComboBox
                value={pickByType[entityType]}
                items={linkableOf(entityType)}
                placeholder={`Привязать ${ENTITY_LABELS[entityType].toLowerCase()}…`}
                onChange={(id) => setPickByType((p) => ({ ...p, [entityType]: id }))}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!pickByType[entityType]}
              onClick={() => void handleAddMember(entityType)}
            >
              Привязать
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => openCreate(entityType)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Создать
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-700 text-gray-100">
          <DialogHeader>
            <DialogTitle>{frontId ? 'Фронт' : 'Новый фронт'}</DialogTitle>
          </DialogHeader>

          {loading && !front && frontId ? (
            <div className="text-sm text-gray-400 py-8 text-center">Загрузка…</div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="general">Общее</TabsTrigger>
                {frontId ? (
                  <>
                    <TabsTrigger value="npc">NPC</TabsTrigger>
                    <TabsTrigger value="story_beat">Сюжет</TabsTrigger>
                    <TabsTrigger value="item">Предметы</TabsTrigger>
                    <TabsTrigger value="counter">Счётчики</TabsTrigger>
                    <TabsTrigger value="wiki">Wiki</TabsTrigger>
                  </>
                ) : null}
              </TabsList>

              <TabsContent value="general" className="space-y-4 pt-3">
                <div className="flex gap-3 items-start">
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-md border border-zinc-700 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: color }}
                    >
                      {iconUrl ? (
                        <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="w-6 h-6 text-white/80" />
                      )}
                    </div>
                    {!readOnly && (
                      <div className="absolute -right-2 -bottom-2">
                        <ImagePicker
                          icon={Layers}
                          filter="icon"
                          title="Иконка фронта"
                          buttonText="Иконка"
                          onSelect={async (url: string) => setIconUrl(url === '' ? null : url)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={name}
                      disabled={readOnly}
                      placeholder="Название фронта"
                      onChange={(e) => setName(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400">Цвет ленты</label>
                      <input
                        type="color"
                        value={color}
                        disabled={readOnly}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-8 w-12 rounded border border-zinc-700 bg-transparent"
                      />
                      {front?.tag_key ? (
                        <span className="text-xs text-violet-300 font-mono">#{front.tag_key}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <label className="block text-xs text-gray-400">
                  Описание (только мастер)
                  <textarea
                    className="mt-1 w-full min-h-[4rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                    value={description}
                    disabled={readOnly}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                {!readOnly && (
                  <div className="flex justify-between gap-2">
                    {frontId ? (
                      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Удалить фронт
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button type="button" onClick={() => void handleSaveMeta()} disabled={!name.trim() || loading}>
                      {frontId ? 'Сохранить' : 'Создать'}
                    </Button>
                  </div>
                )}

                {!frontId ? (
                  <p className="text-xs text-gray-500">
                    Сначала создайте фронт — затем появятся вкладки участников и wiki.
                  </p>
                ) : null}
              </TabsContent>

              {frontId ? (
                <>
                  <TabsContent value="npc">{renderMemberTab('npc')}</TabsContent>
                  <TabsContent value="story_beat">{renderMemberTab('story_beat')}</TabsContent>
                  <TabsContent value="item">{renderMemberTab('item')}</TabsContent>
                  <TabsContent value="counter">{renderMemberTab('counter')}</TabsContent>
                  <TabsContent value="wiki" className="space-y-3 pt-3">
                    {frontId ? (
                      <ScenarioMasterNotesProvider>
                        <div className="h-[min(62vh,560px)] min-h-[360px]">
                          <MasterNotesPanel
                            lockedFrontId={frontId}
                            compact
                            readOnly={!!readOnly}
                            wikiRefreshKey={wikiRefreshKey}
                            onFrontWikiChanged={() => {
                              void reloadFront(frontId);
                              void reloadCatalog();
                              onSaved?.();
                            }}
                          />
                        </div>
                      </ScenarioMasterNotesProvider>
                    ) : null}

                    {!readOnly && frontId ? (
                      <div className="flex flex-wrap gap-2 items-start border-t border-zinc-800 pt-3">
                        <div className="flex-1 min-w-[12rem]">
                          <EntityComboBox
                            value={pickNoteId}
                            items={linkableNotes}
                            placeholder="Привязать существующую wiki…"
                            onChange={setPickNoteId}
                          />
                        </div>
                        <Button type="button" size="sm" disabled={!pickNoteId} onClick={() => void handleLinkWiki()}>
                          Привязать
                        </Button>
                      </div>
                    ) : null}
                  </TabsContent>
                </>
              ) : null}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmAlertDialog
        open={confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(false); }}
        description={<>Удалить фронт «{name}»? Тэг фронта будет снят с участников.</>}
        onConfirm={() => void handleDeleteFront()}
      />

      {nested?.kind === 'npc' ? (
        <NpcEditDialog
          open
          editingId={nested.id}
          readOnly={!!readOnly}
          onClose={closeNested}
          onEntitySaved={(id) => handleEntitySavedFromNested('npc', id)}
        />
      ) : null}

      {nested?.kind === 'story_beat' ? (
        <StoryBeatEditDialog
          open
          editingId={nested.id}
          readOnly={readOnly}
          onClose={closeNested}
          onEntitySaved={(id) => handleEntitySavedFromNested('story_beat', id)}
        />
      ) : null}

      {nested?.kind === 'item' ? (
        <GameItemEditDialog
          open
          editingId={nested.id}
          readOnly={readOnly}
          onClose={closeNested}
          onEntitySaved={(id) => handleEntitySavedFromNested('item', id)}
        />
      ) : null}

      {nested?.kind === 'counter' ? (
        <CounterEditDialog
          open
          editingId={nested.id}
          readOnly={readOnly}
          onClose={closeNested}
          onEntitySaved={(id) => handleEntitySavedFromNested('counter', id)}
        />
      ) : null}
    </>
  );
}

export default function ScenarioFrontsList() {
  const { scenarioId, setTabCount, canEditEntities } = useScenario();
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);
  const [items, setItems] = useState<FrontListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.getFronts();
      setItems(rows);
      setTabCount?.('fronts', rows.length);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fid = params.get('frontId');
    if (fid) {
      setEditingId(fid);
      setReadOnly(!canEditEntities);
      setDialogOpen(true);
    }
  }, [canEditEntities]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Фронты</h2>
          <p className="text-xs text-gray-400">
            Обезличенные силы мира. Видны только мастеру; участники получают цветную ленту на карточках.
          </p>
        </div>
        {canEditEntities ? (
          <Button
            type="button"
            onClick={() => {
              setEditingId(null);
              setReadOnly(false);
              setDialogOpen(true);
            }}
          >
            Новый фронт
          </Button>
        ) : null}
      </div>

      {loading ? <div className="text-sm text-gray-400">Загрузка…</div> : null}
      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <button
            key={f.id}
            type="button"
            className="text-left rounded-xl border border-zinc-700 bg-[#0b1020] overflow-hidden hover:border-zinc-500 transition"
            onClick={() => {
              setEditingId(String(f.id));
              setReadOnly(!canEditEntities);
              setDialogOpen(true);
            }}
          >
            <div className="h-1.5" style={{ backgroundColor: f.color }} />
            <div className="p-3 flex gap-3 items-start">
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
                style={{ backgroundColor: f.color }}
              >
                {f.icon_url ? (
                  <img src={f.icon_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Layers className="w-5 h-5 text-white/90" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{f.name}</div>
                <div className="text-[11px] text-gray-500 font-mono">{f.tag_key}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {f.member_count} уч. · {f.wiki_note_count} wiki
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {!loading && !items.length ? (
        <div className="text-sm text-gray-500 py-8 text-center">Фронтов пока нет</div>
      ) : null}

      <FrontEditDialog
        open={dialogOpen}
        editingId={editingId}
        readOnly={readOnly}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
