"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, BookOpen, Wrench } from "lucide-react";

import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";
import { ScenarioScopedApiService } from "@/app/services/api/scenario_scoped";
import { loadPluginEditorConfigForEntity } from "@/app/services/loadPluginEditorConfigs";
import { CharacterMainTab, CharacterRulesTab } from "@/app/components/scenarios/dialogs/tabs/character";
import { DialogModeProvider } from "@/app/components/scenarios/dialogs/common/DialogModeContext";

import { ItemDraggableSquare } from "@/app/components/common/squares/ItemDraggableSquare";
import { ContextActions } from "@/app/components/common/DraggableSquare";
import { SessionEntityDialogs } from "@/app/components/session/common/SessionEntityDialogs";
import { useSessionEntityDialogs } from "@/app/services/hooks/session/useSessionEntityDialogs";

interface PlayerCharacterTabProps {
  sessionId: string;
}

type TabKey = "story" | "rules" | "items";

export default function PlayerCharacterTab({ sessionId }: PlayerCharacterTabProps) {
  const {
    selfPlayer,
    session,
    scene,
    pluginUI,
    dropItem,
    playerSeen,
  } = usePlayerSessionWebSocket(sessionId);
  const entityDialogs = useSessionEntityDialogs();

  const [activeTab, setActiveTab] = useState<TabKey>("story");

  const [rulesConfig, setRulesConfig] = useState<any>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const scenarioId = session?.scenario_id ? String(session.scenario_id) : null;
  const api = useMemo(
    () => (scenarioId ? new ScenarioScopedApiService(scenarioId) : null),
    [scenarioId],
  );

  if (!selfPlayer) return <div>Нет игрока</div>;

  const character = selfPlayer.character ?? null;
  const characterId = character?.id ?? selfPlayer.character_id;

  if (!character || !characterId) return <div>Нет персонажа</div>;

  const canDrop = !!scene;

  useEffect(() => {
    if (activeTab !== "rules") return;
    if (rulesConfig) return;
    if (!api || !scenarioId) {
      setRulesError("Сценарий сессии недоступен");
      return;
    }

    let cancelled = false;

    (async () => {
      setRulesLoading(true);
      setRulesError(null);
      try {
        const characterData = character.data ?? {};
        const cfg = await loadPluginEditorConfigForEntity({
          scope: { scope: "scenario", id: scenarioId },
          entity: "character",
          needInit: false,
          optionsContext: {
            playbook_id: characterData.playbook_id ?? null,
            level: characterData.level ?? null,
            scene_id: scene?.id ?? null,
          },
          fetchSchema: (entity, etag) => api.getEntitySchema(entity, etag),
          fetchOptions: (entity, ctx) => api.getEntityOptions(entity, ctx),
        });

        if (!cancelled) setRulesConfig(cfg ?? null);
      } catch (e: any) {
        if (!cancelled) setRulesError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, rulesConfig, api, scenarioId, character.data?.playbook_id, character.data?.level, scene?.id]);

  const dlg = useMemo(() => {
    return {
      form: {
        id: character.id,
        name: character.name,
        short_desc: character.short_desc ?? null,
        story: character.story ?? null,
        icon_url: character.icon_url ?? null,
        img_url: character.img_url ?? null,
        owned_items: character.owned_items ?? [],
      },
      assets: {},
      lookups: {
        items: (scene as any)?.public?.items ?? [],
      },
      data: character.data ?? {},
      config: rulesConfig,
      issues: [],
      rulesLoading,
      setForm: undefined,
      setAssets: undefined,
      setData: undefined,
    };
  }, [character, scene, rulesConfig, rulesLoading]);

  const ownedItems = useMemo(() => {
    const raw = character.owned_items ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [character]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="flex flex-col min-h-0 flex-1">
        <TabsList className="mb-2 shrink-0 grid grid-cols-3 w-full h-auto">
          <TabsTrigger value="story" className="flex items-center gap-1 text-xs px-2 py-2">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Нарратив</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1 text-xs px-2 py-2">
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Правила</span>
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-1 text-xs px-2 py-2">
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Вещи</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="story" className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-0 pr-1">
          <DialogModeProvider readOnly={true}>
            <CharacterMainTab dlg={dlg as any} />
          </DialogModeProvider>
        </TabsContent>

        <TabsContent value="rules" className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-0 pr-1">
          {rulesLoading ? <div className="text-xs text-gray-400 mb-2">Загружаю конфиг правил…</div> : null}
          {rulesError ? <div className="text-xs text-red-400 mb-2">Ошибка конфига: {rulesError}</div> : null}

          <DialogModeProvider readOnly={true}>
            <CharacterRulesTab dlg={dlg as any} pluginUI={pluginUI} rulesMode="view" />
          </DialogModeProvider>
        </TabsContent>

        <TabsContent value="items" className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-0 pr-1">
            <div className="flex flex-wrap gap-2">
              {ownedItems.map((it: any) => {
                const id = String(it?.id ?? it);
                return (
                  <ItemDraggableSquare
                    key={id}
                    item={it}
                    isFullSize={true}
                    onInfo={() => entityDialogs.viewItem(it)}
                    contextItems={[
                      {
                        ...ContextActions.dropItem,
                        label: canDrop ? "Бросить в сцену" : "Бросить (нельзя вне сцены)",
                        onClick: () => {
                          if (!canDrop) return;
                          dropItem(id);
                        },
                      },
                    ]}
                  />
                );
              })}

              {ownedItems.length === 0 ? <div className="text-xs text-gray-500 italic">Пусто.</div> : null}
            </div>
        </TabsContent>
      </Tabs>

      <SessionEntityDialogs {...entityDialogs} playerSeen={playerSeen} />
    </div>
  );
}
