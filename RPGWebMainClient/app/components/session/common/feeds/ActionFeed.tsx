'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BaseFeedRow } from "@/app/components/common/BaseFeedRow";
import { useCommonSessionWebSocket } from "@/app/services/hooks/useCommonSessionWebSocket";
import type { SessionAction } from "@/app/services/types/session";
import { useParams } from "next/navigation";
import { useMasterUiStore } from "@/app/services/stores/masterUi";
import { cn } from "@/lib/utils";

export function ActionFeed({ fillAvailable = false }: { fillAvailable?: boolean }) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const removeHiddenActiveActionId = useMasterUiStore((s) => s.removeHiddenActiveActionId);
  const requestFocusActiveActionId = useMasterUiStore((s) => s.requestFocusActiveActionId);

  const openCompletedActionIds = useMasterUiStore((s) => s.openCompletedActionIds);
  const addOpenCompletedActionId = useMasterUiStore((s) => s.addOpenCompletedActionId);

  const { session, actions } = useCommonSessionWebSocket(sessionId) as any;

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const len = Array.isArray(actions) ? actions.length : 0;

    // первый рендер – просто запоминаем длину
    if (prevLen.current === null) {
      prevLen.current = len;
      return;
    }

    // только если реально увеличилось количество действий
    if (len > prevLen.current) {
      el.scrollTop = 0;
    }

    prevLen.current = len;
  }, [actions]);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [actionKeyFilter, setActionKeyFilter] = useState<string>("");

  const allActions: SessionAction[] = Array.isArray(actions) ? actions : [];

  const availableActionKeys = useMemo(
    () => Array.from(new Set(allActions.map(a => a.actionKey).filter(Boolean))).sort(),
    [allActions],
  );

  const sorted = useMemo(() => {
    const arr = allActions
      .filter(a => {
        if (!a) return false;
        if (statusFilter === "active") return a.status === "active";
        if (statusFilter === "completed") return a.status === "completed";
        return true;
      })
      .filter(a => {
        if (!actionKeyFilter) return true;
        return a.actionKey === actionKeyFilter;
      });

    return arr
      .map((a, idx) => ({ a, idx }))
      .sort((x, y) => {
        const ax = x.a?.status === 'active' ? 0 : 1;
        const ay = y.a?.status === 'active' ? 0 : 1;
        if (ax !== ay) return ax - ay;
        return x.idx - y.idx;
      })
      .map((x) => x.a);
  }, [allActions, statusFilter, actionKeyFilter]);

  const scrollClass = cn(
    "overflow-y-auto space-y-1 text-sm",
    fillAvailable ? "flex-1 min-h-0" : "max-h-80",
  );

  if (!session) {
    return (
      <div className={cn("overflow-y-auto bg-gray-950 rounded p-2 text-xs text-gray-500", !fillAvailable && "max-h-80")}>
        Действия недоступны (сессия ещё не загружена)
      </div>
    );
  }

  const handleRowClick = (a: SessionAction) => {
    if (a.status === 'active') {
      removeHiddenActiveActionId(a.id);
      requestFocusActiveActionId(a.id);
    } else if (a.status === 'completed') {
      addOpenCompletedActionId(a.id);
    }
  };

  return (
    <div
      className={cn("bg-gray-950 rounded p-2 space-y-2", fillAvailable && "flex flex-col h-full min-h-0")}
      style={fillAvailable ? undefined : { minHeight: 120 }}
    >
      <div className="flex flex-wrap gap-2 items-center text-xs mb-2">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Статус:</span>
          <div className="inline-flex rounded border border-gray-700 overflow-hidden">
            <button
              type="button"
              className={`px-2 py-0.5 ${
                statusFilter === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-900 text-gray-400'
              }`}
              onClick={() => setStatusFilter('all')}
            >
              Все
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 border-l border-gray-700 ${
                statusFilter === 'active'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-900 text-gray-400'
              }`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 border-l border-gray-700 ${
                statusFilter === 'completed'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-900 text-gray-400'
              }`}
              onClick={() => setStatusFilter('completed')}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-gray-400">actionKey:</span>
          <select
            className="bg-gray-900 border border-gray-700 text-gray-100 rounded px-2 py-0.5 text-xs"
            value={actionKeyFilter}
            onChange={(e) => setActionKeyFilter(e.target.value)}
          >
            <option value="">Все</option>
            {availableActionKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={scrollClass}
        tabIndex={0}
      >
        {sorted.map((a) => (
          <BaseFeedRow key={a.id} id={a.id} dt={undefined as any}>
            <button
              type="button"
              className="text-left w-full"
              onClick={() => handleRowClick(a)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-gray-200">{a.actionKey}</div>
                <div className="text-xs text-gray-500">{a.status}</div>
              </div>

              {a.workflow?.ok === false && a.issues?.length ? (
                <div className="mt-1 text-xs text-red-300">
                  {a.issues[0]?.message ?? 'Ошибка workflow'}
                </div>
              ) : null}

              {a.workflow?.ok === true ? (
                <div className="mt-1 text-xs text-gray-500">
                  step: {a.workflow.step}
                </div>
              ) : null}
            </button>
          </BaseFeedRow>
        ))}

        {sorted.length === 0 && (
          <div className="text-xs text-gray-500 italic px-2 py-1">
            Действий пока нет
          </div>
        )}
      </div>
    </div>
  );
}
