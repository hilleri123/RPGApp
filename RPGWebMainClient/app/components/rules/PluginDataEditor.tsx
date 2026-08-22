'use client';

import { Input } from '@/components/ui/input';
import { setByPath, getByPath } from './dataPath';

type FieldConfig = {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'select';
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
};

export default function PluginDataEditor({
  config,
  data,
  onChange,
}: {
  config: { fields: FieldConfig[] };
  data: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  return (
    <div className="space-y-3">
      {config.fields.map((f) => {
        const v = getByPath(data, f.key);

        if (f.kind === 'select') {
          return (
            <div key={f.key} className="space-y-1">
              <div className="text-sm text-gray-300">{f.label}</div>
              <select
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2"
                value={v ?? ''}
                onChange={(e) => onChange(setByPath(data, f.key, e.target.value))}
              >
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          );
        }

        return (
          <div key={f.key} className="space-y-1">
            <div className="text-sm text-gray-300">{f.label}</div>
            <Input
              value={v ?? ''}
              type={f.kind === 'number' ? 'number' : 'text'}
              min={f.min}
              max={f.max}
              onChange={(e) => {
                const raw = e.target.value;
                const val = f.kind === 'number' ? (raw === '' ? null : Number(raw)) : raw;
                onChange(setByPath(data, f.key, val));
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
