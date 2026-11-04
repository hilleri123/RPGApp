"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dices, Logs, Map, MapPin, SearchCheck, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

import PlayerSceneTab from "./PlayerSceneTab";
import PlayerCharacterTab from "./PlayerCharacterTab";
import PlayerSeenTab from "./PlayerSeenTab";
import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";
import PlayerLogTab from "./PlayerLogTab";
import PlayerMapTab from "./PlayerMapTab";
import PlayerDiceTab from "./PlayerDiceTab";
import { usePreparedSeeds } from "@/app/services/hooks/usePreparedSeeds";
import { GameItem, Location } from "@/app/services/types2";

type Tab = "map" | "scene" | "character" | "log" | "seen" | "dice";

const PLAYER_TABS: readonly Tab[] = ["scene", "map", "character", "log", "seen", "dice"];

const TABS: { id: Tab; label: string; Icon: typeof Map }[] = [
  { id: "scene", label: "Сцена", Icon: MapPin },
  { id: "map", label: "Карта", Icon: Map },
  { id: "character", label: "Герой", Icon: User },
  { id: "log", label: "Лог", Icon: Logs },
  { id: "seen", label: "Мир", Icon: SearchCheck },
  { id: "dice", label: "Кубы", Icon: Dices },
];

const WIDE_QUERY = "(min-width: 1024px)";

function useWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return wide;
}

function usePlayerPanes() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const allowed = useMemo(() => new Set<string>(PLAYER_TABS), []);

  const right = useMemo(() => {
    const raw = searchParams.get("tab");
    return raw && allowed.has(raw) ? (raw as Tab) : "scene";
  }, [searchParams, allowed]);

  const left = useMemo(() => {
    const raw = searchParams.get("left");
    if (!raw || !allowed.has(raw) || raw === right) return null;
    return raw as Tab;
  }, [searchParams, allowed, right]);

  const write = useCallback((nextRight: Tab, nextLeft: Tab | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextRight === "scene") params.delete("tab");
    else params.set("tab", nextRight);
    if (!nextLeft || nextLeft === nextRight) params.delete("left");
    else params.set("left", nextLeft);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return { right, left, write };
}

interface PlayerPageProps {
  sessionId: string;
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;
  setEditingGameItem: (item: GameItem) => void;
}

export default function PlayerPage({
  sessionId,
  currentLocation,
  setCurrentLocation,
}: PlayerPageProps) {
  const { selfPlayer } = usePlayerSessionWebSocket(sessionId);
  const { count: seedCount } = usePreparedSeeds(sessionId);
  const wide = useWideScreen();
  const { right, left, write } = usePlayerPanes();
  const split = wide && left != null;

  // Это основной экран роли, а не необязательный виджет: return null оставлял
  // игрока, вошедшего до назначения персонажа, перед пустотой без объяснений.
  if (!selfPlayer?.character_id) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-6 text-center">
        <User className="w-10 h-10 text-gray-500 mb-3" />
        <p className="text-white font-medium">Персонаж пока не назначен</p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm">
          Мастер ещё не выдал вам персонажа. Экран обновится сам, как только это
          произойдёт — страницу перезагружать не нужно.
        </p>
      </div>
    );
  }

  const pane = (tab: Tab) => (
    <div key={tab} className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {tab === "map" && <PlayerMapTab sessionId={sessionId} />}
      {tab === "scene" && <PlayerSceneTab sessionId={sessionId} />}
      {tab === "character" && <PlayerCharacterTab sessionId={sessionId} />}
      {tab === "log" && <PlayerLogTab sessionId={sessionId} />}
      {tab === "seen" && (
        <PlayerSeenTab
          sessionId={sessionId}
          currentLocation={currentLocation}
          setCurrentLocation={setCurrentLocation}
        />
      )}
      {tab === "dice" && <PlayerDiceTab sessionId={sessionId} />}
    </div>
  );

  return (
    <div className="flex flex-col min-h-0 h-full bg-gray-900">
      <div className={cn("flex min-h-0 flex-1 overflow-hidden px-2 pt-1 pb-1", split && left ? "flex-row" : "flex-col")}>
        {split && left ? (
          <>
            <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
              <button
                type="button"
                onClick={() => write(right, null)}
                className="absolute left-1 top-1 z-30 rounded-md bg-gray-950/80 p-1 text-white/80 hover:text-white"
                aria-label="Закрыть левый экран"
              >
                <X className="h-4 w-4" />
              </button>
              {pane(left)}
            </div>
            <div className="mx-1 w-px shrink-0 bg-gray-700" />
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{pane(right)}</div>
          </>
        ) : (
          pane(right)
        )}
      </div>

      <nav
        className="shrink-0 border-t border-gray-700 bg-gray-800/95 backdrop-blur-sm"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        aria-label="Навигация сессии"
      >
        <div className="grid grid-cols-6 gap-0.5 px-1 pt-1">
          {TABS.map(({ id, label, Icon }) => {
            const isLeft = split && left === id;
            const isRight = split && right === id;
            const sole = !split && right === id;
            const openLeft = () => {
              if (!wide) write(id, null);
              else write(right, id);
            };
            const openRight = () => {
              if (!wide) write(id, null);
              else write(id, left);
            };
            return (
              <button
                key={id}
                type="button"
                onClick={openLeft}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openRight();
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 px-0.5 min-h-[52px] transition-colors",
                  sole && "bg-blue-600 text-white",
                  isLeft && "bg-[linear-gradient(to_bottom_right,#2563eb_50%,transparent_50%)] text-white",
                  isRight && "bg-[linear-gradient(to_bottom_right,transparent_50%,#2563eb_50%)] text-white",
                  !sole && !isLeft && !isRight && "text-gray-400 hover:bg-gray-700/60 hover:text-gray-200",
                )}
                aria-current={sole || isLeft || isRight ? "page" : undefined}
              >
                <span className="relative">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {id === "dice" && seedCount > 0 ? (
                    <span className="absolute -right-2 -top-1 min-w-[14px] rounded-full bg-violet-500 px-0.5 text-center text-[9px] leading-3 text-white">
                      {seedCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] leading-tight font-medium truncate max-w-full">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
