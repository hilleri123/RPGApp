'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useScenario } from '@/app/components/scenarios/ScenarioContext';
import ScenarioModal from '@/app/components/scenarios/ScenarioModal';
import { ScenarioAccessPanel } from '@/app/components/scenarios/ScenarioAccessPanel';
import { TemplatePacksPanel } from './TemplatePacksPanel';
import { NamePacksPanel } from './NamePacksPanel';
import { ScenarioTagsPanel } from './ScenarioTagsPanel';
import { formatGameTimeLabel } from '@/app/components/session/common/gameTime';

export function ScenarioSettingsTab() {
  const { scenario, reloadScenario, canEditMeta, canEditEntities, canDelete } = useScenario();
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (!scenario) return null;

  return (
    <div className="max-w-2xl space-y-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-base font-semibold text-white">Сценарий</h2>
          <p className="text-sm text-gray-500">
            ID: <span className="font-mono text-gray-400">{scenario.id}</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Система правил: <span className="text-gray-400">{scenario.rule_id_str ?? '—'}</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Стартовое игровое время:{' '}
            <span className="text-gray-300">{formatGameTimeLabel(scenario.scenario_starts_at)}</span>
          </p>
        </div>

        {canEditMeta ? (
          <Button onClick={() => setIsEditOpen(true)}>
            Редактировать
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300 space-y-2">
        <div>
          <span className="text-gray-500">Название:</span>{' '}
          <span>{scenario.name || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Описание:</span>{' '}
          <span>{scenario.intro || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Макс. игроков:</span>{' '}
          <span>{scenario.max_players ?? '—'}</span>
        </div>
      </div>

      <TemplatePacksPanel
        scenario={scenario}
        canEdit={canEditMeta || canEditEntities}
        onChanged={reloadScenario}
      />

      <NamePacksPanel
        scenario={scenario}
        canEdit={canEditMeta || canEditEntities}
        onChanged={reloadScenario}
      />

      <ScenarioTagsPanel />

      {/* Выдавать доступ может только владелец сценария — так же считает и бэкенд. */}
      {canDelete ? <ScenarioAccessPanel scenarioId={scenario.id} /> : null}

      <ScenarioModal
        key={scenario.id}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={reloadScenario}
        scenario={scenario}
      />
    </div>
  );
}