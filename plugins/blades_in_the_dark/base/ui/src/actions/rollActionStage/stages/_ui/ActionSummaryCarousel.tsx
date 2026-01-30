'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ActionPositionEffectLine } from './BladesBadges';
import { ActionRollPanel } from './ActionRollPanel';
import { ActionResistPanel } from './ActionResistPanel';

type TabKey = 'summary' | 'roll' | 'resist';

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`px-3 py-1.5 text-sm rounded border transition-colors ${
        active ? 'border-zinc-200 text-white bg-zinc-900/40' : 'border-zinc-700 text-muted-foreground hover:bg-zinc-900/20'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ActionSummaryCarousel({ action }: { action: any }) {
  const wf: any = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const hasRoll = !!ctx?.roll;
  const hasResist = !!ctx?.resist;

  const tabs = useMemo(() => {
    const out: Array<{ key: TabKey; label: string }> = [{ key: 'summary', label: 'Сводка' }];
    if (hasRoll) out.push({ key: 'roll', label: 'Бросок' });
    if (hasResist) out.push({ key: 'resist', label: 'Резист' });
    return out;
  }, [hasRoll, hasResist]);

  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? 'summary');

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = {
    summary: useRef<HTMLDivElement | null>(null),
    roll: useRef<HTMLDivElement | null>(null),
    resist: useRef<HTMLDivElement | null>(null),
  };

  const scrollTo = (key: TabKey) => {
    setActive(key);
    const el = panelRefs[key].current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <TabBtn key={t.key} active={active === t.key} onClick={() => scrollTo(t.key)}>
            {t.label}
          </TabBtn>
        ))}
      </div>

      {/* Swipe/scroll area */}
      <div
        ref={scrollerRef}
        className="w-full overflow-x-auto snap-x snap-mandatory flex gap-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Panel: Summary */}
        <div ref={panelRefs.summary} className="snap-center shrink-0 w-full">
          <div className="rounded border p-3 flex flex-col gap-2">
            <div className="font-medium">Сводка</div>
            <ActionPositionEffectLine action={action} />
          </div>
        </div>

        {/* Panel: Roll */}
        {hasRoll ? (
          <div ref={panelRefs.roll} className="snap-center shrink-0 w-full">
            <ActionRollPanel action={action} />
          </div>
        ) : null}

        {/* Panel: Resist */}
        {hasResist ? (
          <div ref={panelRefs.resist} className="snap-center shrink-0 w-full">
            <ActionResistPanel action={action} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
