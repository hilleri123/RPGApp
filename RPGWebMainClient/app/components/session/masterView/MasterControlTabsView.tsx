"use client";

import { useEffect, useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Hash,
  Trash2,
  BookOpen,
  Users,
  Package,
  Shield,
  Inbox,
  UserRound,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MasterNotesPanel } from "@/app/components/masterNotes/MasterNotesPanel";
import { Counter, StoryBeatOut } from "@/app/services/types2";
import { useSessionWebSocket } from "@/app/services/hooks/useSessionWebSocket";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import SessionCounterCreateDialog from "./control/dialogs/SessionCounterCreateDialog";
import { useMasterUiStore } from "@/app/services/stores/masterUi";
import { StoryBeatPicker } from "./story_beat/StoryBeatPicker";
import { StoryBeatApplyDialog } from "./story_beat/StoryBeatApplyDialog";
import { ScenarioScopedApiService } from "@/app/services/api/scenario_scoped";
import { SessionMessagesPanel } from "@/app/components/session/common/feeds/SessionMessagesPanel";
import { MasterEntityCatalogTab } from "./MasterEntityCatalogTab";
import { SessionEntityDialogs } from "@/app/components/session/common/SessionEntityDialogs";
import { useSessionEntityDialogs } from "@/app/services/hooks/session/useSessionEntityDialogs";
import ObstacleSessionEditDialog from "./control/dialogs/ObstacleSessionEditDialog";
import type { MasterContentTab } from "@/app/services/stores/masterUi";
import { useCommonSessionWebSocket } from "@/app/services/hooks/useCommonSessionWebSocket";
import { countUnread } from "@/app/components/session/common/sessionMessages";
import { useUrlTab } from "@/app/services/hooks/useUrlTab";
import { CounterValueControl } from "@/app/components/scenarios/dialogs/common/CounterValueControl";
import { SessionFrontsTab } from "./SessionFrontsTab";
import {
  EntityTagFilterChips,
  collectTagKeysFromItems,
  entityHasAllTags,
} from "@/app/components/scenarios/dialogs/common/EntityTagFilterChips";
import type { FrontListItem } from "@/app/services/types2";

const MASTER_CONTENT_TABS: readonly MasterContentTab[] = [
  "storyBeats",
  "counters",
  "messages",
  "wiki",
  "fronts",
  "npcs",
  "items",
  "obstacles",
  "characters",
];

interface MasterContentPanelProps {
  sessionId: string;
}

export function MasterContentPanel({ sessionId }: MasterContentPanelProps) {
  const {
    counters,
    isMaster,
    session,
    storyBeats,
    scenes,
    applySceneExposure,
    reloadSessionFields,
  } = useSessionWebSocket(sessionId);

  const { dispatches } = useCommonSessionWebSocket(sessionId);
  const selfUserId = String(session?.master?.id ?? "");
  const messagesUnread = countUnread(dispatches ?? [], selfUserId);

  const api = useMemo(
    () => (session?.scenario_id ? new ScenarioScopedApiService(String(session.scenario_id)) : null),
    [session?.scenario_id]
  );

  const [activeTab, setActiveTab] = useUrlTab<MasterContentTab>(
    MASTER_CONTENT_TABS,
    "storyBeats",
    { paramName: "sub" },
  );
  const [counterValues, setCounterValues] = useState<Record<string, number>>({});
  const [obstacleOpen, setObstacleOpen] = useState(false);

  const entityDialogs = useSessionEntityDialogs();
  const { setNpcDlg, setItemDlg, setCharacterDlg } = entityDialogs;

  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const wikiTabRequest = useMasterUiStore((s) => s.wikiTabRequest);
  const contentFrontId = useMasterUiStore((s) => s.contentFrontId);
  const setContentFrontId = useMasterUiStore((s) => s.setContentFrontId);
  const contentFrontFilterCollapsed = useMasterUiStore((s) => s.contentFrontFilterCollapsed);
  const setContentFrontFilterCollapsed = useMasterUiStore((s) => s.setContentFrontFilterCollapsed);

  const [fronts, setFronts] = useState<FrontListItem[]>([]);

  useEffect(() => {
    if (wikiTabRequest > 0) setActiveTab("wiki");
  }, [wikiTabRequest, setActiveTab]);

  useEffect(() => {
    if (!api) {
      setFronts([]);
      return;
    }
    void api.getFronts().then(setFronts).catch(() => setFronts([]));
  }, [api]);

  const contentFront = useMemo(
    () => (contentFrontId ? fronts.find((f) => String(f.id) === String(contentFrontId)) ?? null : null),
    [contentFrontId, fronts],
  );

  const contentFrontTagKey = useMemo(() => contentFront?.tag_key ?? null, [contentFront]);

  const frontRequiredTags = useMemo(
    () => (contentFrontTagKey ? [contentFrontTagKey] : []),
    [contentFrontTagKey],
  );

  const currentScene = useMemo(
    () => (scenes ?? []).find((sc) => sc.id === currentSceneId) ?? null,
    [scenes, currentSceneId],
  );

  useEffect(() => {
    setCounterValues((prev) => {
      const next: Record<string, number> = {};
      for (const c of counters) {
        next[c.id] = c.value ?? 0;
      }
      return next;
    });
  }, [counters]);

  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<
    { type: "counter"; id: string; name: string } | null
  >(null);

  const [storyBeatDialogOpen, setStoryBeatDialogOpen] = useState(false);
  const [selectedStoryBeat, setSelectedStoryBeat] =
    useState<StoryBeatOut | null>(null);
  const [counterTagFilter, setCounterTagFilter] = useState<string[]>([]);
  const [counterNameFilter, setCounterNameFilter] = useState("");

  const counterTagOptions = useMemo(
    () => collectTagKeysFromItems(counters ?? []),
    [counters],
  );

  const filteredCounters = useMemo(() => {
    const q = counterNameFilter.trim().toLowerCase();
    return (counters ?? []).filter((c) => {
      if (!entityHasAllTags(c.tags, frontRequiredTags)) return false;
      if (!entityHasAllTags(c.tags, counterTagFilter)) return false;
      if (!q) return true;
      return String(c.name ?? "").toLowerCase().includes(q);
    });
  }, [counters, counterTagFilter, counterNameFilter, frontRequiredTags]);

  const openConfirmDeleteCounter = (counter: Counter) => {
    setConfirmTarget({ type: "counter", id: counter.id, name: counter.name });
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget || !api) return;
    try {
      await api.deleteCounter(confirmTarget.id);
      reloadSessionFields(["counters"]);
    } finally {
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wide hover:text-gray-300"
            onClick={() => setContentFrontFilterCollapsed(!contentFrontFilterCollapsed)}
            title={contentFrontFilterCollapsed ? "Показать фильтр фронта" : "Скрыть фильтр фронта"}
          >
            {contentFrontFilterCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
            Фронт
          </button>
          {contentFrontFilterCollapsed && contentFront ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-300 min-w-0">
              <span
                className="w-4 h-4 rounded-sm border border-white/20 overflow-hidden shrink-0 flex items-center justify-center"
                style={{ backgroundColor: contentFront.color || "#7c3aed" }}
              >
                {contentFront.icon_url ? (
                  <img src={contentFront.icon_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Layers className="w-2.5 h-2.5 text-white/80" />
                )}
              </span>
              <span className="truncate">{contentFront.name}</span>
            </span>
          ) : null}
          {contentFrontFilterCollapsed && !contentFront ? (
            <span className="text-[11px] text-gray-600">все</span>
          ) : null}
        </div>

        {!contentFrontFilterCollapsed ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setContentFrontId(null)}
              className={[
                "inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs transition-colors",
                !contentFrontId
                  ? "border-violet-500/60 bg-violet-600/20 text-violet-100"
                  : "border-gray-700 bg-gray-900/60 text-gray-400 hover:border-gray-500 hover:text-gray-200",
              ].join(" ")}
            >
              Все
            </button>
            {fronts.map((f) => {
              const selected = String(contentFrontId) === String(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setContentFrontId(selected ? null : String(f.id))}
                  className={[
                    "inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-md border text-xs max-w-[180px] transition-colors",
                    selected
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-500",
                  ].join(" ")}
                  title={f.name}
                >
                  <span
                    className="w-5 h-5 rounded-sm border border-white/15 overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: f.color || "#7c3aed" }}
                  >
                    {f.icon_url ? (
                      <img src={f.icon_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Layers className="w-3 h-3 text-white/80" />
                    )}
                  </span>
                  <span className="truncate">{f.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as MasterContentTab)}
        className="w-full flex flex-col min-h-0 h-full"
      >
        <TabsList className="mb-3 h-auto min-h-10">
          <TabsTrigger value="storyBeats" className="flex items-center gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" /> Стори‑биты
          </TabsTrigger>
          <TabsTrigger value="counters" className="flex items-center gap-1.5 text-xs">
            <Hash className="w-3.5 h-3.5" /> Счётчики
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-1.5 text-xs">
            <Inbox className="w-3.5 h-3.5" /> Сообщения
            {messagesUnread > 0 && (
              <span className="ml-0.5 text-[10px] bg-violet-700 rounded-full px-1 py-0 leading-none">
                {messagesUnread}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="wiki" className="flex items-center gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" /> Wiki
          </TabsTrigger>
          <TabsTrigger value="fronts" className="flex items-center gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5" /> Фронты
          </TabsTrigger>
          <TabsTrigger value="npcs" className="flex items-center gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" /> NPC
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-1.5 text-xs">
            <Package className="w-3.5 h-3.5" /> Предметы
          </TabsTrigger>
          <TabsTrigger value="obstacles" className="flex items-center gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" /> Препятствия
          </TabsTrigger>
          <TabsTrigger value="characters" className="flex items-center gap-1.5 text-xs">
            <UserRound className="w-3.5 h-3.5" /> Персонажи
          </TabsTrigger>
        </TabsList>

        <TabsContent value="storyBeats" className="flex-1 min-h-0">
          <StoryBeatPicker
            storyBeats={storyBeats ?? []}
            scene={currentScene}
            requiredTags={frontRequiredTags}
            onSelect={(beat) => {
              setSelectedStoryBeat(beat);
              setStoryBeatDialogOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 min-h-0 overflow-hidden">
          <SessionMessagesPanel sessionId={sessionId} variant="master" />
        </TabsContent>

        <TabsContent value="wiki" className="flex-1 min-h-0">
          <MasterNotesPanel />
        </TabsContent>

        <TabsContent value="fronts" className="flex-1 min-h-0 overflow-hidden">
          {session?.scenario_id ? (
            <SessionFrontsTab scenarioId={String(session.scenario_id)} />
          ) : (
            <div className="text-xs text-gray-500 p-2">Нет привязанного сценария</div>
          )}
        </TabsContent>

        <TabsContent value="counters" className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-3">
            <div className="flex justify-between items-center mb-2 gap-2">
              <span className="text-sm text-gray-300">Счётчики</span>
              {isMaster && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCounterModalOpen(true)}
                >
                  + Новый счётчик
                </Button>
              )}
            </div>
            <div className="mb-3 space-y-2">
              <Input
                value={counterNameFilter}
                onChange={(e) => setCounterNameFilter(e.target.value)}
                placeholder="Поиск по имени…"
                className="h-8 text-sm"
              />
              {counterTagOptions.length > 0 ? (
                <EntityTagFilterChips
                  options={counterTagOptions}
                  value={counterTagFilter}
                  onChange={setCounterTagFilter}
                />
              ) : null}
            </div>
            <div className="space-y-2 text-white">
              {filteredCounters.map((c) => {
                const currentValue = counterValues[c.id] ?? c.value ?? 0;
                return (
                  <div
                    key={c.id}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex justify-between items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {c.name}{" "}
                        <span className="text-gray-400 text-xs">
                          {c.min_value != null ||
                          c.max_value != null
                            ? `(${c.min_value ?? "-"}…${
                                c.max_value ?? "-"
                              })`
                            : ""}
                        </span>
                      </div>
                      {c.description && (
                        <div className="text-xs text-gray-300 mt-1">
                          {c.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {api ? (
                        <CounterValueControl
                          scenarioId={String(session?.scenario_id)}
                          counter={c}
                          value={currentValue}
                          compact
                          readOnly={!isMaster}
                          onValueChange={(updated) => {
                            setCounterValues((prev) => ({
                              ...prev,
                              [c.id]: updated.value ?? 0,
                            }));
                            reloadSessionFields(["counters"]);
                          }}
                        />
                      ) : null}
                      {isMaster && (
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() =>
                            openConfirmDeleteCounter(c)
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredCounters.length === 0 && (
                <div className="text-xs text-gray-500 italic">
                  {(counters?.length ?? 0) === 0
                    ? "Счётчиков пока нет"
                    : "Ничего не найдено"}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="npcs" className="flex-1 min-h-0 overflow-auto">
          <MasterEntityCatalogTab
            sessionId={sessionId}
            kind="npc"
            requiredTags={frontRequiredTags}
            onCreate={() => setNpcDlg({ entity: null, readOnly: false })}
            onEditNpc={entityDialogs.editNpc}
            onViewNpc={entityDialogs.viewNpc}
            onEditItem={entityDialogs.editItem}
            onViewItem={entityDialogs.viewItem}
          />
        </TabsContent>

        <TabsContent value="items" className="flex-1 min-h-0 overflow-auto">
          <MasterEntityCatalogTab
            sessionId={sessionId}
            kind="item"
            requiredTags={frontRequiredTags}
            onCreate={() => setItemDlg({ entity: null, readOnly: false })}
            onEditNpc={entityDialogs.editNpc}
            onViewNpc={entityDialogs.viewNpc}
            onEditItem={entityDialogs.editItem}
            onViewItem={entityDialogs.viewItem}
          />
        </TabsContent>

        <TabsContent value="obstacles" className="flex-1 min-h-0">
          <MasterEntityCatalogTab
            sessionId={sessionId}
            kind="obstacle"
            onCreateObstacle={() => setObstacleOpen(true)}
          />
        </TabsContent>

        <TabsContent value="characters" className="flex-1 min-h-0 overflow-auto">
          <MasterEntityCatalogTab
            sessionId={sessionId}
            kind="character"
            requiredTags={frontRequiredTags}
            onCreate={() => setCharacterDlg({ entity: null, readOnly: false })}
            onEditCharacter={entityDialogs.editCharacter}
            onViewCharacter={entityDialogs.viewCharacter}
          />
        </TabsContent>
      </Tabs>

      <SessionEntityDialogs {...entityDialogs} />
      <ObstacleSessionEditDialog open={obstacleOpen} onClose={() => setObstacleOpen(false)} />

      <SessionCounterCreateDialog
        open={counterModalOpen}
        onClose={() => setCounterModalOpen(false)}
      />

      <StoryBeatApplyDialog
        open={storyBeatDialogOpen}
        onClose={() => {
          setStoryBeatDialogOpen(false);
          setSelectedStoryBeat(null);
        }}
        storyBeat={selectedStoryBeat}
        sceneId={currentScene ? currentScene.id : null}
        applySceneExposure={applySceneExposure}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Подтверждение удаления"
        message={
          confirmTarget
            ? `Удалить счётчик «${confirmTarget.name}»?`
            : "Удалить?"
        }
        confirmText="Удалить"
        cancelText="Отмена"
      />
    </div>
  );
}

/** @deprecated use MasterContentPanel */
export const MasterControlTabsView = MasterContentPanel;
