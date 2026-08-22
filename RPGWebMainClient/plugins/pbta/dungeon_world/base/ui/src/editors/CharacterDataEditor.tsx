'use client';

import type { ReactNode } from 'react';
import { ClipboardList, Footprints, Sparkles } from 'lucide-react';
import BaseCharacterDataEditor from '../../../../../base/ui/src/editors/CharacterDataEditor';
import { CharacterResourcesPanel } from '../../../../../base/ui/src/shared/CharacterResourcesPanel';
import { SpellBookPanel } from '../shared/SpellBookPanel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DWCharacterConfig, CharacterData } from '../types/character';
import type { ValidationIssue } from '../../../../../base/ui/src/types';
import { computeCharacterStats } from '../../../../../base/ui/src/lib/pbta';
import { getPlaybookId, getStats } from '../../../../../base/ui/src/types/character';
import { getResourceSpecs } from '../../../../../base/ui/src/types/pbta';

type Props = {
  data:     CharacterData;
  config:   DWCharacterConfig;
  issues?:  ValidationIssue[];
  onChange: (next: CharacterData) => void;
};

export default function DWCharacterDataEditor({ data, config, issues, onChange }: Props) {
  const playbooks  = config?.pbta?.playbooks ?? [];
  const stats      = getStats(data);
  const playbookId = getPlaybookId(data);
  const playbookObj = playbooks.find((p) => p.id === playbookId) ?? null;
  const resourceSpecs = getResourceSpecs(config?.pbta);

  const { maxHp } = computeCharacterStats(playbookObj, stats);

  const hp:          number = Number(data?.hp          ?? 0);
  const armorCache:  number = Number(data?.armor_cache ?? 0);
  const currentLevel: number = Number(data?.level      ?? 1);
  const currentXp:   number = Number(data?.xp          ?? 0);

  const setField = <K extends keyof CharacterData>(field: K, value: CharacterData[K]) => {
    onChange({ ...structuredClone(data), [field]: value });
  };

  return (
    <Tabs defaultValue="sheet" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="sheet" className="flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Лист
        </TabsTrigger>
        <TabsTrigger value="moves" className="flex items-center gap-1.5">
          <Footprints className="w-3.5 h-3.5" /> Ходы
        </TabsTrigger>
        <TabsTrigger value="spells" className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Заклинания
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sheet" className="mt-4 space-y-6">
        <BaseCharacterDataEditor
          data={data}
          config={config}
          issues={issues}
          onChange={onChange}
          hideMoves
          hideResources
        />

        {playbookObj && (
          <section className="space-y-2">
            <div className="text-sm text-gray-300">Состояние</div>
            <div className="flex flex-wrap gap-3 items-end">
              <LabeledNumberInput
                label={<>ОЗ <span className="text-gray-600">/ {maxHp}</span></>}
                value={hp}
                min={0}
                max={maxHp}
                onChange={(v) => setField('hp', v)}
              />
              <LabeledNumberInput
                label="Броня"
                value={armorCache}
                min={0}
                max={10}
                onChange={(v) => setField('armor_cache', v)}
              />
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="text-sm text-gray-300">Прогресс</div>
          <div className="flex flex-wrap gap-3 items-end">
            <LabeledNumberInput
              label="Уровень"
              value={currentLevel}
              min={1}
              max={10}
              onChange={(v) => setField('level', v)}
            />
            <LabeledNumberInput
              label="Опыт"
              value={currentXp}
              min={0}
              onChange={(v) => setField('xp', v)}
            />
          </div>
        </section>

        <CharacterResourcesPanel
          data={data}
          resourceSpecs={resourceSpecs}
          editable
          onChange={(next) => onChange(next as CharacterData)}
        />
      </TabsContent>

      <TabsContent value="moves" className="mt-4">
        <BaseCharacterDataEditor
          data={data}
          config={config}
          issues={issues}
          onChange={onChange}
          hideSheet
          hideResources
        />
      </TabsContent>

      <TabsContent value="spells" className="mt-4">
        <SpellBookPanel
          playbookId={playbookId}
          pbtaConfig={config?.pbta}
          data={data}
          editable
          onChange={onChange}
        />
      </TabsContent>
    </Tabs>
  );
}

function LabeledNumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: ReactNode;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      <span>{label}</span>
      <Input
        type="number"
        className="w-24 bg-zinc-950/40"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}
