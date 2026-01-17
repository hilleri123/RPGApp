'use client';

type Props = {
  data: Record<string, any>;
  config?: any;
};

type SkillGroup = { id: string; title: string; color?: string };
type Skill = { id: string; title: string; group: string; min?: number; max?: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function CharacterDataView({ data, config }: Props) {
  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  const skillValues: Record<string, number> = data?.skills ?? {};

  // сгруппировать skills по group
  const byGroup = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  const groupIndex = new Map(groups.map(g => [g.id, g]));

  const orderedGroupIds = groups.length ? groups.map(g => g.id) : Object.keys(byGroup);

  return (
    <div className="space-y-3">
      {orderedGroupIds.map((gid) => {
        const g = groupIndex.get(gid) ?? { id: gid, title: gid, color: '#64748b' }; // slate-500-ish
        const items = byGroup[gid] ?? [];
        if (!items.length) return null;

        return (
          <div key={gid} className="border border-gray-700 rounded-md overflow-hidden bg-black/20">
            {/* Заголовок группы */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: g.color ?? '#64748b' }}
                  title={g.id}
                />
                <div className="text-sm text-white">{g.title}</div>
              </div>

              <div
                className="text-[11px] px-2 py-0.5 rounded border border-gray-700"
                style={{ color: g.color ?? '#94a3b8' }}
              >
                {gid}
              </div>
            </div>

            {/* Скиллы группы */}
            <div className="divide-y divide-gray-800">
              {items.map((s) => {
                const min = s.min ?? 0;
                const max = s.max ?? 10;
                const raw = Number(skillValues?.[s.id] ?? 0);
                const value = clamp(isFinite(raw) ? raw : 0, min, max);
                const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

                return (
                  <div key={s.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6 md:col-span-5 text-sm text-gray-100">
                      {s.title}
                      <span className="ml-2 text-xs text-gray-500">({s.id})</span>
                    </div>

                    {/* Полоска */}
                    <div className="col-span-4 md:col-span-5">
                      <div className="h-2 rounded bg-gray-800 overflow-hidden border border-gray-700">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: g.color ?? '#64748b',
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    </div>

                    {/* Значение */}
                    <div className="col-span-2 text-right">
                      <span
                        className="text-sm font-medium"
                        style={{ color: g.color ?? '#e2e8f0' }}
                      >
                        {value}
                      </span>
                      <span className="text-xs text-gray-500">/{max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* fallback если нет config */}
      {(!skills.length || !groups.length) && (
        <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}
