'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { scenariosApiService } from '@/app/services/api/scenario';
import { useAuth } from '@/app/services/hooks/useAuth';
import type { Scenario, ScenarioCreate } from '@/app/services/types2';
import { RuleSystemSelect } from '@/app/components/rules/RuleSystemSelect';

interface ScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  scenario: Scenario | null;
  /** Предзаполнить rule_id_str при создании */
  initialRuleId?: string;
  /** Вызывается после успешного создания нового сценария */
  onCreated?: (scenario: Scenario) => void;
}

function isoToLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export default function ScenarioModal({
  isOpen,
  onClose,
  onSave,
  scenario,
  initialRuleId,
  onCreated,
}: ScenarioModalProps) {
  const { state } = useAuth();
  const { user } = state;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<ScenarioCreate>({
    name: '',
    intro: '',
    max_players: 4,
    rule_id_str: undefined,
    user_id: user?.id,
    scenario_starts_at: undefined,
  });

  useEffect(() => {
    setForm({
      name: scenario?.name || '',
      intro: scenario?.intro || '',
      max_players: scenario?.max_players || 4,
      rule_id_str: scenario?.rule_id_str || initialRuleId || undefined,
      user_id: user?.id,
      scenario_starts_at: scenario?.scenario_starts_at || undefined,
    });
  }, [scenario, user, isOpen, initialRuleId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...form,
        scenario_starts_at: form.scenario_starts_at || undefined,
      };

      if (scenario) {
        await scenariosApiService.updateScenario(scenario.id, payload);
      } else {
        const created = await scenariosApiService.createScenario(payload);
        onCreated?.(created);
      }

      await onSave();
      onClose();
    } catch (err) {
      setError('Ошибка сохранения сценария');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {scenario ? 'Редактировать сценарий' : 'Создать сценарий'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Название сценария</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label>Описание</Label>
            <Input
              value={form.intro ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
            />
          </div>

          <div>
            <Label>Максимум игроков</Label>
            <Input
              type="number"
              value={form.max_players ?? 4}
              onChange={(e) =>
                setForm((f) => ({ ...f, max_players: Number(e.target.value) }))
              }
              min={1}
              max={100}
            />
          </div>

          <RuleSystemSelect
            label="Правило"
            value={form.rule_id_str ?? ''}
            onChange={(val) => setForm((f) => ({ ...f, rule_id_str: val || undefined }))}
            allowEmpty
          />

          <div>
            <Label>Начало сценария</Label>
            <Input
              type="datetime-local"
              value={isoToLocalInput(form.scenario_starts_at)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  scenario_starts_at: localInputToIso(e.target.value),
                }))
              }
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? <Loader2 className="animate-spin" /> : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}