'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { scenariosApiService } from '@/app/services/api/scenario';
import type { RuleSystemInfo } from '@/app/services/types2';

function ruleId(rule: RuleSystemInfo): string {
  return String(rule.id ?? rule.plugin_id ?? '');
}

function ruleName(rule: RuleSystemInfo): string {
  return String(rule.name ?? rule.plugin_name ?? ruleId(rule));
}

export function RuleSystemSelect({
  value,
  onChange,
  label = 'Система правил',
  placeholder = 'Выберите правило',
  allowEmpty = true,
  className,
}: {
  value: string;
  onChange: (ruleId: string) => void;
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const [rules, setRules] = useState<RuleSystemInfo[]>([]);

  useEffect(() => {
    void scenariosApiService.getRuleSystems().then(setRules);
  }, []);

  return (
    <div className={className}>
      {label ? <Label className="text-gray-300 mb-1 block">{label}</Label> : null}
      <Select
        value={value || (allowEmpty ? '__none__' : '')}
        onValueChange={(val) => onChange(val === '__none__' ? '' : val)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value="__none__">— не выбрано —</SelectItem>
          ) : null}
          {rules.map((rule) => {
            const id = ruleId(rule);
            if (!id) return null;
            return (
              <SelectItem key={id} value={id}>
                {ruleName(rule)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function useRuleSystemLabels() {
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    void scenariosApiService.getRuleSystems().then((rules) => {
      const m: Record<string, string> = {};
      for (const r of rules) {
        const id = ruleId(r);
        if (id) m[id] = ruleName(r);
      }
      setLabels(m);
    });
  }, []);

  return (id?: string | null) => (id ? labels[id] ?? id : '—');
}
