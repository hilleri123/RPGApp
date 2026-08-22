'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ActionPositionEffectLine, Badge } from './BladesBadges';
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
        active
          ? 'border-zinc-200 text-white bg-zinc-900/40'
          : 'border-zinc-700 text-muted-foreground hover:bg-zinc-900/20'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function outcomeMeta(outcome: any): { label: string; color: string; isSuccess: boolean | null } {
  const s = String(outcome ?? '').toLowerCase();
  if (s === 'bad') return { label: 'Провал', color: '#ef4444', isSuccess: false };
  if (s === 'mixed') return { label: 'Успех с последствиями', color: '#eab308', isSuccess: true };
  if (s === 'good') return { label: 'Успех', color: '#22c55e', isSuccess: true };
  if (s === 'critical' || s === 'crit') return { label: 'Крит', color: '#38bdf8', isSuccess: true };
  return { label: '—', color: '#a1a1aa', isSuccess: null };
}

function StressEventsSummary({ events }: { events: any[] }) {
  if (!Array.isArray(events) || events.length === 0) return null;

  return (
    <div className="rounded border px-3 py-2 bg-zinc-950/30 flex flex-col gap-2">
      <div className="text-sm font-medium">Стресс</div>

      <div className="flex flex-col gap-1 text-sm">
        {events.map((e, idx) => {
          const who = e?.character_id ? String(e.character_id) : '—';
          const reason = String(e?.reason ?? '—');
          const oldV = Number(e?.old ?? 0);
          const delta = Number(e?.delta ?? 0);
          const newV = Number(e?.new ?? 0);
          const overflow = !!e?.overflow;

          const reasonLabel =
            reason === 'push' ? 'Push (+2)' : reason === 'assist' ? 'Assist (+1 helper)' : reason === 'resist' ? 'Resist' : reason;

          return (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{reasonLabel}:</span>
              <span className="font-semibold text-white">
                {oldV} → {newV}
              </span>
              <span className="text-muted-foreground">({delta >= 0 ? `+${delta}` : String(delta)})</span>

              {overflow ? (
                <Badge
                  text="Trauma trigger (stress→0)"
                  color="#f472b6"
                  title="В Blades при заполнении стресса персонаж получает травму, а стресс сбрасывается в 0."
                />
              ) : null}

              <span className="text-xs text-muted-foreground">id:{who}</span>
            </div>
          );
        })}
      </div>
    </div>
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

  const roll = ctx?.roll ?? null;
  const { label: outcomeLabel, color: outcomeColor, isSuccess } = outcomeMeta(roll?.outcome);
  const stressEvents = Array.isArray(ctx?.stressEvents) ? ctx.stressEvents : [];

  const needsTrauma = !!ctx?.needsTrauma;
  const traumaId = ctx?.trauma ? String(ctx.trauma) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <TabBtn key={t.key} active={active === t.key} onClick={() => scrollTo(t.key)}>
            {t.label}
          </TabBtn>
        ))}
      </div>

      <div
        ref={scrollerRef}
        className="w-full overflow-x-auto snap-x snap-mandatory flex gap-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div ref={panelRefs.summary} className="snap-center shrink-0 w-full">
          <div className="rounded border p-3 flex flex-col gap-3">
            <div className="font-medium">Сводка</div>

            <ActionPositionEffectLine action={action} />

            {hasRoll ? (
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted-foreground">Результат:</span>
                <Badge text={outcomeLabel} color={outcomeColor} title={String(roll?.outcome ?? '')} />
                {isSuccess === true ? (
                  <span className="text-xs text-muted-foreground">(успех)</span>
                ) : isSuccess === false ? (
                  <span className="text-xs text-muted-foreground">(не успех)</span>
                ) : null}
              </div>
            ) : null}

            {needsTrauma ? (
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <Badge
                  text="Нужна травма"
                  color="#f472b6"
                  title="Персонаж(и) заполнил стресс. В Blades стресс сбрасывается в 0 и нужно выбрать trauma."
                />
                {ctx?.traumaCharacterId ? (
                  <span className="text-xs text-muted-foreground">character:{String(ctx.traumaCharacterId)}</span>
                ) : null}
              </div>
            ) : traumaId ? (
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <Badge text={`Trauma: ${traumaId}`} color="#f472b6" title="Выбранная травма" />
              </div>
            ) : null}

            <StressEventsSummary events={stressEvents} />
          </div>
        </div>

        {hasRoll ? (
          <div ref={panelRefs.roll} className="snap-center shrink-0 w-full">
            <ActionRollPanel action={action} />
          </div>
        ) : null}

        {hasResist ? (
          <div ref={panelRefs.resist} className="snap-center shrink-0 w-full">
            <ActionResistPanel action={action} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
