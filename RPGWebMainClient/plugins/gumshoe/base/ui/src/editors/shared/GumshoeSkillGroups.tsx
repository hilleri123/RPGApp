'use client';

import { Button } from '@/components/ui/button';
import { Skill, SkillGroup, ValidationIssue } from '../../types';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

function alpha(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Иконка (i) с тултипом описания навыка */
export function SkillTooltip({ description }: { description?: string | null }) {
  if (!description) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Описание навыка"
            className="inline-flex items-center shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs leading-relaxed bg-gray-900 border border-gray-700 text-gray-200 shadow-xl"
        >
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type SkillGroupsCheckboxProps = {
  mode: 'checkbox';
  groups: SkillGroup[];
  skills: Skill[];
  selected: string[];
  onToggle: (id: string) => void;
  issueMap?: Map<string, ValidationIssue>;
};

type SkillGroupsNumberProps = {
  mode: 'number';
  groups: SkillGroup[];
  skills: Skill[];
  values: Record<string, number>;
  onChange: (id: string, value: number | null) => void;
  issueMap?: Map<string, ValidationIssue>;
  initialValues?: Record<string, number>;
  exceededSkillIds?: Set<string>;
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
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] px-2 py-0.5 rounded border"
                  style={{ borderColor: border ?? '#374151', color }}
                >
                  {g.id}
                </span>
                {g.kind && (
                  <span className="text-[11px] text-gray-400">{g.kind}</span>
                )}
              </div>
            </div>

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
                const isExceeded = props.mode === 'number' && props.exceededSkillIds?.has(s.id);
                const hasVisualError = isErr || !!isExceeded;
                const extraHint = isExceeded && !errorText
                  ? 'Текущее значение выше начального'
                  : errorText;

                if (props.mode === 'checkbox') {
                  const checked = props.selected.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => props.onToggle(s.id)}
                        className="accent-indigo-500"
                      />
                      <span>
                        {s.title}
                        <span className="ml-1 text-xs text-gray-500">({s.id})</span>
                      </span>
                      <SkillTooltip description={(s as any).description} />
                    </label>
                  );
                }

                const rawValue = props.values?.[s.id];
                const display =
                  typeof rawValue === 'number' && Number.isFinite(rawValue)
                    ? String(rawValue)
                    : '';

                const initVal =
                  props.mode === 'number' && props.initialValues
                    ? props.initialValues[s.id]
                    : undefined;

                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm text-gray-200 truncate">{s.title}</span>
                        <span className="text-xs text-gray-500 shrink-0">({s.id})</span>
                        <SkillTooltip description={(s as any).description} />
                      </div>
                      {extraHint && (
                        <span
                          className={`text-xs shrink-0 ${
                            hasVisualError ? 'text-red-400' : 'text-yellow-300'
                          }`}
                        >
                          {extraHint}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const current = display === '' ? 0 : Number(display);
                            const next = Math.max(0, (Number.isFinite(current) ? current : 0) - 1);
                            props.onChange(s.id, next === 0 && display === '' ? null : next);
                          }}
                          aria-label="Уменьшить на 1"
                          className="shrink-0"
                        >
                          −
                        </Button>

                        <Input
                          type="number"
                          value={display}
                          min={0}
                          step={1}
                          placeholder="Нет навыка"
                          onWheel={(e) => {
                            e.currentTarget.blur();
                          }}
                          onChange={(e) => {
                            const txt = e.target.value;
                            if (txt === '') {
                              props.onChange(s.id, null);
                              return;
                            }
                            const v = Number(txt);
                            props.onChange(s.id, Number.isFinite(v) && v >= 0 ? v : 0);
                          }}
                          className={`w-full rounded border px-2 py-1 text-sm text-center ${
                            hasVisualError ? 'border-red-500' : ''
                          }`}
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const current = display === '' ? 0 : Number(display);
                            const next = (Number.isFinite(current) ? current : 0) + 1;
                            props.onChange(s.id, next);
                          }}
                          aria-label="Увеличить на 1"
                          className="shrink-0"
                        >
                          +
                        </Button>
                      </div>
                      {initVal !== undefined && (
                        <span className="text-xs text-gray-500 shrink-0" title="Начальное значение">
                          / {initVal}
                        </span>
                      )}

                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 shrink-0"
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