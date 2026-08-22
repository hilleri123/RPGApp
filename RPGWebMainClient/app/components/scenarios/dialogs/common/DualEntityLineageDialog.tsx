'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import {
  EntityLineage,
  launchedScenariosApi,
} from '@/app/services/api/launchedScenarios';
import { PLAY_TERMS } from '@/app/services/types/playTerms';

type Props = {
  open: boolean;
  onClose: () => void;
  scenarioId: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
};

type ScalarForm = {
  name: string;
  description_for_master: string;
  description_for_players: string;
  text: string;
  text_for_master: string;
  text_for_players: string;
};

function field(obj: Record<string, unknown> | null | undefined, key: keyof ScalarForm): string {
  const v = obj?.[key];
  return v == null ? '' : String(v);
}

function toScalarForm(obj: Record<string, unknown> | null | undefined): ScalarForm {
  return {
    name: field(obj, 'name'),
    description_for_master: field(obj, 'description_for_master'),
    description_for_players: field(obj, 'description_for_players'),
    text: field(obj, 'text'),
    text_for_master: field(obj, 'text_for_master'),
    text_for_players: field(obj, 'text_for_players'),
  };
}

function formToPatchFields(form: ScalarForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) {
    if (v.trim()) out[k] = v;
    else if (k === 'name') out[k] = v;
  }
  return out;
}

function ScalarFields({
  form,
  onChange,
  readOnly,
}: {
  form: ScalarForm;
  onChange: (next: ScalarForm) => void;
  readOnly?: boolean;
}) {
  const set = (key: keyof ScalarForm, val: string) => onChange({ ...form, [key]: val });

  return (
    <div className="space-y-2">
      <Input
        value={form.name}
        readOnly={readOnly}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Название"
      />
      <Textarea
        value={form.description_for_master || form.text_for_master}
        readOnly={readOnly}
        onChange={(e) => {
          set('description_for_master', e.target.value);
          set('text_for_master', e.target.value);
        }}
        placeholder="Для мастера"
        rows={3}
      />
      <Textarea
        value={form.description_for_players || form.text_for_players || form.text}
        readOnly={readOnly}
        onChange={(e) => {
          set('description_for_players', e.target.value);
          set('text_for_players', e.target.value);
          set('text', e.target.value);
        }}
        placeholder="Для игроков / текст"
        rows={3}
      />
    </div>
  );
}

export function DualEntityLineageDialog({
  open,
  onClose,
  scenarioId,
  entityType,
  entityId,
  entityLabel,
}: Props) {
  const [lineage, setLineage] = useState<EntityLineage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [launchedForm, setLaunchedForm] = useState<ScalarForm>(toScalarForm(null));
  const [prepForm, setPrepForm] = useState<ScalarForm>(toScalarForm(null));

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const data = await launchedScenariosApi.getEntityLineage(scenarioId, entityType, entityId);
      setLineage(data);
      setLaunchedForm(toScalarForm(data.current));
      setPrepForm(toScalarForm(data.prep ?? null));
    } finally {
      setLoading(false);
    }
  }, [open, scenarioId, entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async (direction: 'to_prep' | 'to_launched') => {
    setBusy(true);
    try {
      await launchedScenariosApi.syncEntityLineage(scenarioId, {
        entity_type: entityType,
        entity_id: entityId,
        direction,
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveSide = async (side: 'current' | 'prep') => {
    setBusy(true);
    try {
      const fields = formToPatchFields(side === 'current' ? launchedForm : prepForm);
      await launchedScenariosApi.patchEntityLineage(scenarioId, {
        entity_type: entityType,
        entity_id: entityId,
        side,
        fields,
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const ensurePrep = async () => {
    setBusy(true);
    try {
      await launchedScenariosApi.ensurePrepEntity(scenarioId, entityType, entityId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const prepId = lineage?.prep_scenario_id;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Редактирование с оригиналом{entityLabel ? `: ${entityLabel}` : ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : lineage ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Слева — объект в {PLAY_TERMS.launchedScenario.toLowerCase()}, справа — в исходном сценарии.
              Объекты с привязкой к оригиналу нельзя удалить из запущенного сценария.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3 rounded border border-amber-800/50 p-3">
                <h3 className="font-medium text-amber-100">Текущий (запущенный)</h3>
                <ScalarFields form={launchedForm} onChange={setLaunchedForm} />
                <Button size="sm" disabled={busy} onClick={() => void saveSide('current')}>
                  Сохранить текущий
                </Button>
              </div>

              <div className="space-y-3 rounded border border-blue-800/50 p-3">
                <h3 className="font-medium text-blue-100">
                  Оригинал (prep)
                  {lineage.prep_scenario_name ? `: ${lineage.prep_scenario_name}` : ''}
                </h3>
                {lineage.has_prep_entity && lineage.prep ? (
                  <>
                    <ScalarFields form={prepForm} onChange={setPrepForm} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => void saveSide('prep')}>
                        Сохранить оригинал
                      </Button>
                      {prepId && lineage.prep_entity_id ? (
                        <Link
                          href={`/scenarios/${prepId}`}
                          className="text-sm text-blue-400 underline self-center"
                        >
                          Открыть исходный сценарий
                        </Link>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400 space-y-2">
                    <p>Оригинал не привязан (старый клон без source_entity_id).</p>
                    <Button size="sm" onClick={() => void ensurePrep()} disabled={busy}>
                      Создать копию в исходном сценарии
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !lineage.has_prep_entity}
                onClick={() => void sync('to_prep')}
              >
                Текущий → оригинал
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !lineage.has_prep_entity}
                onClick={() => void sync('to_launched')}
              >
                Оригинал → текущий
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
