'use client';

import { Input } from '@/components/ui/input';
import type { MoveGrantResource, PbtaSkill, ResourceSpec } from '../types/pbta';

const TIER_OPTIONS = [
  { id: '', label: 'всегда' },
  { id: '10_plus', label: '10+' },
  { id: '7_9', label: '7–9' },
  { id: '6_minus', label: '6−' },
  { id: 'any_hit', label: '7+' },
];

type Props = {
  grants: MoveGrantResource[];
  resourceSpecs: ResourceSpec[];
  skills?: PbtaSkill[];
  onChange: (next: MoveGrantResource[]) => void;
};

export function MoveGrantResourcesEditor({ grants, resourceSpecs, onChange }: Props) {
  const addFromSpec = (spec: ResourceSpec) => {
    onChange([
      ...grants,
      {
        spec_id: spec.id,
        amount: 1,
        on_tier: [],
        target: 'self',
        description: spec.title,
      },
    ]);
  };

  const addCustom = () => {
    const specId = `custom_res_${Date.now()}`;
    onChange([
      ...grants,
      {
        spec_id: specId,
        inline_spec: {
          id: specId,
          title: 'Кастомный ресурс',
          kind: 'custom',
          description: '',
        },
        amount: 1,
        on_tier: [],
        target: 'self',
        description: 'Кастомный ресурс',
      },
    ]);
  };

  const patch = (idx: number, next: Partial<MoveGrantResource>) => {
    onChange(grants.map((g, i) => (i === idx ? { ...g, ...next } : g)));
  };

  const remove = (idx: number) => {
    onChange(grants.filter((_, i) => i !== idx));
  };

  const copyGrant = (idx: number) => {
    const src = grants[idx];
    if (!src) return;
    onChange([...grants, { ...structuredClone(src), description: `${src.description || src.spec_id} (копия)` }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {resourceSpecs.map((spec) => (
          <button
            key={spec.id}
            type="button"
            onClick={() => addFromSpec(spec)}
            className="text-[10px] rounded border border-cyan-800/50 px-2 py-0.5 text-cyan-200 hover:border-cyan-500"
          >
            + {spec.title}
          </button>
        ))}
        <button
          type="button"
          onClick={addCustom}
          className="text-[10px] rounded border border-gray-700 px-2 py-0.5 text-gray-400 hover:border-gray-500"
        >
          + кастомный
        </button>
      </div>

      {grants.length === 0 && (
        <div className="text-[11px] text-gray-500">Ресурсы хода не заданы.</div>
      )}

      {grants.map((gr, idx) => {
        const isCustom = !!gr.inline_spec;
        const specTitle = gr.inline_spec?.title ?? resourceSpecs.find((s) => s.id === gr.spec_id)?.title ?? gr.spec_id;
        return (
          <div key={`${gr.spec_id}-${idx}`} className="rounded border border-cyan-900/40 bg-cyan-950/10 p-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-cyan-100 font-medium">{specTitle}</span>
              <span className="text-[10px] text-gray-500 font-mono">{gr.spec_id}</span>
              <button type="button" className="text-[10px] text-cyan-300 ml-auto" onClick={() => copyGrant(idx)}>
                Копировать
              </button>
              <button type="button" className="text-[10px] text-red-400" onClick={() => remove(idx)}>
                Удалить
              </button>
            </div>

            {isCustom && gr.inline_spec && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  value={gr.inline_spec.title}
                  placeholder="Название ресурса"
                  className="text-xs h-8"
                  onChange={(e) => patch(idx, {
                    inline_spec: { ...gr.inline_spec!, title: e.target.value },
                    description: e.target.value,
                  })}
                />
                <select
                  className="rounded border border-gray-700 bg-black/40 text-xs px-2 h-8"
                  value={gr.inline_spec.kind ?? 'custom'}
                  onChange={(e) => patch(idx, {
                    inline_spec: { ...gr.inline_spec!, kind: e.target.value },
                  })}
                >
                  <option value="bonus">бонус</option>
                  <option value="forward">forward</option>
                  <option value="ongoing">ongoing</option>
                  <option value="spell">заклинание</option>
                  <option value="ammo">боезапас</option>
                  <option value="custom">custom</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <LabeledInput
                label="Кол-во"
                type="number"
                value={String(gr.amount ?? 1)}
                onChange={(v) => patch(idx, { amount: Number(v || 1) })}
              />
              <div className="space-y-0.5">
                <div className="text-[9px] uppercase text-gray-500">Когда</div>
                <select
                  className="w-full rounded border border-gray-700 bg-black/40 text-xs px-1 h-8"
                  value={(gr.on_tier ?? [])[0] ?? ''}
                  onChange={(e) => patch(idx, { on_tier: e.target.value ? [e.target.value] : [] })}
                >
                  {TIER_OPTIONS.map((o) => (
                    <option key={o.id || 'any'} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <LabeledInput
                label="Описание"
                value={gr.description ?? ''}
                onChange={(v) => patch(idx, { description: v })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] uppercase text-gray-500">{label}</div>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs h-8"
      />
    </div>
  );
}
