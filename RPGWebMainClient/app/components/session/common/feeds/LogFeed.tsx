// components/session/feeds/LogFeed.tsx
import { useEffect, useRef } from "react";
import { BaseFeedRow } from "@/app/components/common/BaseFeedRow";
import { LogMsgRenderer } from "./log/LogMsgRenderer";
import { useCommonSessionWebSocket } from "@/app/services/hooks/useCommonSessionWebSocket";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  fillAvailable?: boolean;
}

export function LogFeed({ sessionId, fillAvailable = false }: Props) {
  const {
    logs,
    session,
    characters,
    npcs,
    items,
    locations,
  } = useCommonSessionWebSocket(sessionId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(logs.length);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (logs.length > prevLen.current) {
      el.scrollTop = 0;
    }
    prevLen.current = logs.length;
  }, [logs]);

  const scrollClass = cn(
    "overflow-y-auto bg-gray-950 rounded p-2 space-y-1 text-sm",
    fillAvailable ? "h-full min-h-0" : "max-h-80",
  );

  if (!session) {
    return (
      <div className={cn("overflow-y-auto bg-gray-950 rounded p-2 text-xs text-gray-500", !fillAvailable && "max-h-80")}>
        Логи недоступны (сессия ещё не загружена)
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={scrollClass}
      style={fillAvailable ? undefined : { minHeight: 120 }}
      tabIndex={0}
    >
      {logs.slice().reverse().map((msg) => (
        <BaseFeedRow
          key={msg.id + (msg.log_type ?? "")}
          id={msg.id + (msg.log_type ?? "")}
          dt={msg.dt}
        >
          <LogMsgRenderer
            msg={msg}
            session={session}
            characters={characters}
            npcs={npcs}
            items={items}
            locations={locations}
          />
        </BaseFeedRow>
      ))}
      {logs.length === 0 && (
        <div className="text-xs text-gray-500 italic px-2 py-1">
          Логов пока нет
        </div>
      )}
    </div>
  );
}
