'use client';

import { useMemo } from 'react';
import { GumshoeSkill, GumshoeSkillGroup, ValidationIssue } from '../../types';
import { Input } from '@/components/ui/input';

function alpha(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Режим number — числовой инпут (для персонажа)
// Режим checkbox — чекбокс (для препятствий)
type SkillGroupsCheckboxProps = {
  mode: 'checkbox';
  groups: GumshoeSkillGroup[];
  skills: GumshoeSkill[];
  selected: string[];
  onToggle: (id: string) => void;
  issueMap?: Map<string, ValidationIssue>;
};

type SkillGroupsNumberProps = {
  mode: 'number';
  groups: GumshoeSkillGroup[];
  skills: GumshoeSkill[];
  values: Record<string, number>;
  onChange: (id: string, value: number | null) => void; // null = удалить навык
  issueMap?: Map<string, ValidationIssue>;
};

type Props = SkillGroupsCheckboxProps | SkillGroupsNumberProps;

export default function GumshoeSkillGroups(props: Props) {
  const { groups, skills, issueMap } = props;

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const groupSkills = skills.filter((s) => s.group === g.id);
        if (!groupSkills.length) return null;

        const color = g.color ?? '#64748b';
        const bg = alpha(color, 0.08);
        const border = alpha(color, 0.35);

        return (
          <div
            key={g.id}
            className="rounded-md overflow-hidden border"
            style={{
              borderColor: border ?? '#374151',
              backgroundColor: bg ?? 'rgba(0,0,0,0.15)',
            }}
          >
            {/* Заголовок группы */}
            <div
              className="px-3 py-2 border-b flex items-center justify-between"
              style={{ borderColor: border ?? '#374151' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div className="text-sm font-semibold text-gray-100">{g.title}</div>
              </div>
              <div className="text-[11px] text-gray-400">{g.id}</div>
            </div>

            {/* Навыки */}
            <div
              className={`p-3 ${
                props.mode === 'checkbox'
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-2'
                  : 'grid grid-cols-1 md:grid-cols-2 gap-3'
              }`}
            >
              {groupSkills.map((s) => {
                const issue =
                  issueMap?.get(`gumshoe_skills.${s.id}`) ||
                  issueMap?.get(`gumshoe_skills.${s.id}.value`) ||
                  issueMap?.get('investigative_skills');
                const errorText = issue?.message;
                const isErr = !!errorText && (issue?.level ?? 'error') === 'error';

                if (props.mode === 'checkbox') {
                  const checked = props.selected.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 text-sm text-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => props.onToggle(s.id)}
                      />
                      <span>
                        {s.title}
                        <span className="ml-1 text-xs text-gray-500">({s.id})</span>
                      </span>
                    </label>
                  );
                }

                // mode === 'number'
                const hasValue = Object.prototype.hasOwnProperty.call(
                  props.values ?? {},
                  s.id,
                );
                const rawValue = hasValue ? props.values[s.id] : undefined;
                const display =
                  typeof rawValue === 'number' && Number.isFinite(rawValue)
                    ? String(rawValue)
                    : '';

                return (
                  <div key={s.id} className="space-y-1">
                    <div className="text-sm text-gray-300 flex justify-between gap-2">
                      <span className="text-gray-200">
                        {s.title}
                        <span className="ml-2 text-xs text-gray-500">({s.id})</span>
                      </span>
                      {errorText && (
                        <span
                          className={`text-xs ${
                            isErr ? 'text-red-400' : 'text-yellow-300'
                          }`}
                        >
                          {errorText}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={display}
                        min={0}
                        placeholder="" // пустой плейсхолдер = "навыка нет"
                        onChange={(e) => {
                          const txt = e.target.value;
                          if (txt === '') {
                            // удалить навык — он "вообще не взят"
                            props.onChange(s.id, null);
                            return;
                          }
                          const v = Number(txt);
                          if (!Number.isFinite(v) || v < 0) {
                            props.onChange(s.id, 0);
                          } else {
                            props.onChange(s.id, v);
                          }
                        }}
                        className={`w-full rounded border px-2 py-1 text-sm ${
                          isErr ? 'border-red-500' : ''
                        }`}
                      />
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
                        onClick={() => props.onChange(s.id, null)}
                      >
                        сбросить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
