'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import type { Scene } from "@/app/services/types/session";
import { useMasterUiStore } from "@/app/services/stores/masterUi";
import { useParams } from "next/navigation";
import { useSessionWebSocket } from "@/app/services/hooks/useSessionWebSocket";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { openScenePopout } from "./openScenePopout";

type SceneSlot = "top" | "subscene";

type SceneMenuState =
  | { open: false }
  | {
      open: true;
      sceneId: string;
      x: number;
      y: number;
      title: string;
      hasChildren: boolean;
      hasSubLocations: boolean;
      slot: SceneSlot;
    };

function sceneInTopRow(scene: Scene): boolean {
  if (typeof scene.in_top_row === "boolean") return scene.in_top_row;
  return !scene.parent_scene_id;
}

/** Копия, которую прошлая версия создавала отдельной сценой. В рядах её не показываем. */
function isLegacyPromotedCopy(scene: Scene, all: readonly Scene[]): boolean {
  const marker = scene.sublocation_of_scene_id;
  if (!marker || scene.parent_scene_id) return false;
  return all.some((other) =>
    other.id !== scene.id
    && String(other.parent_scene_id ?? "") === String(marker)
    && String(other.location?.id ?? "") === String(scene.location?.id ?? ""),
  );
}

function normalizeColor(x: string | undefined): string {
  return x && x.trim().length ? x : '#94a3b8';
}
function uniqStrings(xs: readonly string[]): string[] {
  return Array.from(new Set(xs));
}
function charIdsOfScene(scene: Scene): Set<string> {
  return new Set(scene.characters.map((c) => String(c.id)));
}

function PlayerDots({ colors }: { colors: readonly string[] }) {
  if (colors.length === 0) return null;
  const max = 6;
  const shown = colors.slice(0, max);
  const extra = colors.length - shown.length;
  return (
    <span className="pointer-events-none absolute top-1 right-1 inline-flex items-center gap-1">
      {shown.map((c, i) => (
        <span key={`${c}-${i}`} className="inline-block h-2 w-2 rounded-full border border-black/40" style={{ backgroundColor: c }} />
      ))}
      {extra > 0 && <span className="ml-0.5 text-[10px] text-white/70 leading-none">+{extra}</span>}
    </span>
  );
}

export default function SceneHeader({
  currentSceneId,
  onSelectSceneId,
  onPrev,
  onNext,
  onAddScene,
  canAddScene,
}: {
  currentSceneId: string | null;
  onSelectSceneId: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onAddScene: () => void;
  canAddScene: boolean;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [menu, setMenu] = useState<SceneMenuState>({ open: false });
  const [focusSlot, setFocusSlot] = useState<SceneSlot>("top");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pinnedFocus = useRef<{ id: string; slot: SceneSlot } | null>(null);

  const { scenes, locations, session, delScene, expandScene, collapseScene } = useSessionWebSocket(sessionId);
  const setCurrentSceneId = useMasterUiStore((s) => s.setCurrentSceneId);

  const rootScenes = useMemo(
    () => (scenes ?? []).filter((s: Scene) => sceneInTopRow(s) && !isLegacyPromotedCopy(s, scenes ?? [])),
    [scenes],
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string, Scene[]>();
    for (const s of scenes) {
      if (s.parent_scene_id) {
        const key = String(s.parent_scene_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
      }
    }
    return (id: string) => map.get(id) ?? [];
  }, [scenes]);

  // Полоса «↳ подсцены» остаётся у родителя, если фокус на нижнем виджете.
  const activeRootId = useMemo(() => {
    if (!currentSceneId) return null;
    const scene = (scenes ?? []).find((s: Scene) => s.id === currentSceneId);
    if (!scene) return null;
    if (focusSlot === "subscene" && scene.parent_scene_id) return String(scene.parent_scene_id);
    if (sceneInTopRow(scene)) return scene.id;
    return scene.parent_scene_id ? String(scene.parent_scene_id) : scene.id;
  }, [currentSceneId, focusSlot, scenes]);

  // подсцены показываем только для активной корневой сцены
  const visibleChildren = useMemo(
    () => activeRootId ? childrenOf(activeRootId) : [],
    [activeRootId, childrenOf],
  );

  const currentIndex = useMemo(() => {
    if (!currentSceneId) return -1;
    // currentIndex считаем по rootScenes, если текущая — дочерняя, берём индекс её родителя
    const effectiveId = activeRootId ?? currentSceneId;
    return rootScenes.findIndex((s: Scene) => s.id === effectiveId);
  }, [rootScenes, currentSceneId, activeRootId]);

  const total = rootScenes.length;
  const players = session?.players ?? [];

  const colorsForSceneId = useMemo(() => {
    const cache = new Map<string, string[]>();
    for (const sc of scenes) {
      const ids = charIdsOfScene(sc);
      const colors = players
        .filter((p: any) => p.character ? ids.has(String(p.character.id)) : false)
        .map((p: any) => normalizeColor(p.color));
      cache.set(sc.id, uniqStrings(colors));
    }
    return (sceneId: string) => cache.get(sceneId) ?? [];
  }, [scenes, players]);

  const subLocationCountOf = useMemo(() => {
    const childrenOfLocation = new Map<string, Set<string>>();
    const addChild = (parentId: string | null | undefined, childId: string | null | undefined) => {
      if (!parentId || !childId || String(parentId) === String(childId)) return;
      const key = String(parentId);
      if (!childrenOfLocation.has(key)) childrenOfLocation.set(key, new Set());
      childrenOfLocation.get(key)!.add(String(childId));
    };
    for (const loc of locations ?? []) {
      addChild((loc as any).parent_location_id, loc.id);
      for (const polygon of (loc as any).map_objects ?? []) {
        addChild(loc.id, polygon?.target_location_id);
      }
    }
    const map = new Map<string, number>();
    for (const s of scenes) {
      const locationId = s.location?.id ? String(s.location.id) : "";
      map.set(s.id, childrenOfLocation.get(locationId)?.size ?? 0);
    }
    return (sceneId: string) => map.get(sceneId) ?? 0;
  }, [locations, scenes]);

  const selectWidget = (sceneId: string, slot: SceneSlot) => {
    pinnedFocus.current = { id: sceneId, slot };
    setFocusSlot(slot);
    onSelectSceneId(sceneId);
    setCurrentSceneId(sceneId);
  };

  useEffect(() => {
    if (!currentSceneId) return;
    const scene = (scenes ?? []).find((s: Scene) => s.id === currentSceneId);
    if (!scene) return;
    if (pinnedFocus.current?.id === currentSceneId) {
      if (pinnedFocus.current.slot === "subscene" && !scene.parent_scene_id) {
        pinnedFocus.current = { id: currentSceneId, slot: "top" };
        setFocusSlot("top");
      }
      return;
    }
    const slot: SceneSlot = scene.parent_scene_id ? "subscene" : "top";
    pinnedFocus.current = { id: currentSceneId, slot };
    setFocusSlot(slot);
  }, [currentSceneId, scenes]);

  const showInTopRow = (scene: Scene) => {
    expandScene(scene.id);
    selectWidget(scene.id, "subscene");
  };

  useEffect(() => {
    if (!menu.open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setMenu({ open: false });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu({ open: false }); };
    const onScroll = () => setMenu({ open: false });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu.open]);

  const renderSceneButton = (s: Scene, idx: number, isChild = false) => {
    const slot: SceneSlot = isChild ? "subscene" : "top";
    const active = s.id === currentSceneId && slot === focusSlot;
    // у дочерней — подсвечиваем родителя если она активна
    const parentActive = !isChild && s.id === activeRootId && s.id !== currentSceneId;
    const title = s.name ?? (isChild ? `Подсцена ${idx + 1}` : `Сцена ${idx + 1}`);
    const parentSceneName = s.parent_scene_id
      ? scenes.find((other: Scene) => other.id === s.parent_scene_id)?.name
      : undefined;
    const sublocationMark = !isChild && s.parent_scene_id
      ? `подлокация «${parentSceneName || "другой сцены"}»`
      : "";
    const colors = colorsForSceneId(s.id);
    const children = childrenOf(s.id);
    const hasChildren = children.length > 0;
    const subLocCount = subLocationCountOf(s.id);
    const hasSubLocations = subLocCount > 0;

    return (
      <div key={`${slot}-${s.id}`} className="inline-flex items-center gap-0.5">
        <Button
          onClick={() => selectWidget(s.id, slot)}
          onContextMenu={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            setMenu({ open: true, sceneId: s.id, x: e.clientX, y: e.clientY, title, hasChildren, hasSubLocations, slot });
          }}
          className={[
            "relative px-3 py-1 border text-sm whitespace-nowrap",
            isChild ? "text-xs py-0.5" : "",
            active
              ? "bg-gray-800 border-gray-600"
              : parentActive
                ? "bg-gray-800/60 border-gray-700"
                : "bg-gray-900 border-gray-800 hover:bg-gray-800",
            hasChildren || active ? "rounded-l rounded-r-none border-r-0" : "rounded",
          ].join(" ")}
          title={sublocationMark ? `${title} · ${sublocationMark}` : title}
        >
          {title}
          {!isChild && sublocationMark && (
            <span className="ml-1.5 text-[10px] text-amber-300/80">{sublocationMark}</span>
          )}
          {!isChild && !hasChildren && hasSubLocations && (
            <span className="ml-1.5 text-[10px] text-gray-500 font-mono">+{subLocCount}</span>
          )}
          <PlayerDots colors={colors} />
        </Button>

        {isChild && (
          <Button
            onClick={() => showInTopRow(s)}
            className="px-1.5 py-0.5 rounded border text-xs bg-gray-900 border-gray-800 hover:bg-gray-800"
            title="Раскрыть в верхнем ряду"
          >
            <ChevronDown className="w-3 h-3" />
          </Button>
        )}

        {!isChild && hasChildren && (
          <Button
            onClick={() => selectWidget(s.id, "top")}
            className={[
              "px-1.5 py-1 border border-l-0 text-sm",
              active ? "rounded-none" : "rounded-r",
              active || parentActive ? "bg-gray-800 border-gray-600" : "bg-gray-900 border-gray-800 hover:bg-gray-800",
            ].join(" ")}
            title="Показать подсцены"
          >
            <ChevronDown className="w-3 h-3" />
          </Button>
        )}

        {active ? (
          <Button
            type="button"
            className="px-1.5 py-1 rounded-r border border-l-0 text-sm bg-gray-800 border-gray-600 hover:bg-gray-700"
            title="Открыть сцену в отдельном окне (другой монитор)"
            onClick={(e) => {
              e.stopPropagation();
              openScenePopout(sessionId, s.id);
            }}
          >
            <ExternalLink className="w-3 h-3 text-violet-300" />
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="border-b border-gray-800 bg-gray-950">
      {/* основная полоса */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="shrink-0">
          <div className="text-xs text-gray-500">
            {total > 0 && currentIndex >= 0 ? `${currentIndex + 1} / ${total}` : "0 / 0"}
          </div>
        </div>

        <div className="shrink-0 flex gap-2">
          <Button className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50" onClick={onPrev} disabled={total === 0 || currentIndex <= 0}>
            <ArrowLeft />
          </Button>
        </div>

        <div className="flex-1 overflow-x-auto whitespace-nowrap">
          <div className="inline-flex gap-2">
            {rootScenes.map((s: Scene, idx: number) => renderSceneButton(s, idx))}
          </div>
        </div>

        <div className="shrink-0 flex gap-2">
          <Button className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50" onClick={onNext} disabled={total === 0 || currentIndex < 0 || currentIndex >= total - 1}>
            <ArrowRight />
          </Button>
          <Button
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            onClick={onAddScene}
            disabled={!canAddScene}
            title={!canAddScene ? "Сначала выбери локацию слева" : undefined}
          >
            + Сцена
          </Button>
        </div>
      </div>

      {/* подполоса — показывается только если активная сцена имеет дочерние */}
      {visibleChildren.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-800 bg-gray-900/50">
          <div className="text-xs text-gray-600 shrink-0 w-16">↳ подсцены</div>
          <div className="flex-1 overflow-x-auto whitespace-nowrap">
            <div className="inline-flex gap-2">
              {visibleChildren.map((s: Scene, idx: number) => renderSceneButton(s, idx, true))}
            </div>
          </div>
        </div>
      )}

      {/* контекстное меню */}
      {menu.open && (
        <div className="fixed inset-0 z-50" onContextMenu={(e) => e.preventDefault()}>
          <div ref={menuRef} className="fixed z-50 min-w-44 rounded-md border border-gray-700 bg-gray-950 shadow-lg p-1" style={{ left: menu.x, top: menu.y }}>
            <div className="px-2 py-1 text-xs text-gray-400">{menu.title}</div>

            <button
              type="button"
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-800 text-violet-300 hover:text-violet-200 flex items-center gap-2"
              onClick={() => {
                const id = menu.sceneId;
                setMenu({ open: false });
                openScenePopout(sessionId, id);
              }}
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              Открыть в отдельном окне
            </button>

            {menu.slot === "subscene" && (
              <button type="button" className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-800 text-blue-300 hover:text-blue-200"
                onClick={() => {
                  const child = scenes.find((s: Scene) => s.id === menu.sceneId);
                  setMenu({ open: false });
                  if (child) showInTopRow(child);
                }}>
                Раскрыть в верхнем ряду
              </button>
            )}

            {menu.slot === "top" && menu.hasSubLocations && (
              <button type="button" className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-800 text-blue-300 hover:text-blue-200"
                onClick={() => { const id = menu.sceneId; setMenu({ open: false }); expandScene(id); }}>
                Раскрыть по локациям
              </button>
            )}

            {menu.hasChildren && (
              <button type="button" className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-800 text-yellow-300 hover:text-yellow-200"
                onClick={() => { const id = menu.sceneId; setMenu({ open: false }); collapseScene(id); }}>
                Схлопнуть подсцены
              </button>
            )}

            <button type="button" className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-900 text-red-400 hover:text-red-300"
              onClick={() => {
                const id = menu.sceneId;
                const slot = menu.slot;
                setMenu({ open: false });
                delScene(id, slot);
              }}>
              {(() => {
                const target = scenes.find((s: Scene) => s.id === menu.sceneId);
                const both = !!target?.parent_scene_id && sceneInTopRow(target);
                if (both && menu.slot === "top") return "Убрать из верхнего ряда";
                if (both && menu.slot === "subscene") return "Убрать из подсцен";
                return "Удалить";
              })()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}