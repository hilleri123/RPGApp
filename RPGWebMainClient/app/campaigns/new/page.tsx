'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/app/components/layout/Header';
import { campaignsApiService } from '@/app/services/api/campaign';
import { scenariosApiService } from '@/app/services/api/scenario';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import { lobbyApiService } from '@/app/services/api/lobby';
import {
  Campaign,
  CampaignCreate,
  CampaignScenarioLink,
} from '@/app/services/types/campaign';
import { Scenario } from '@/app/services/types2';
import { ScenarioParty } from '@/app/services/types/launchedScenario';
import { RuleSystemSelect } from '@/app/components/rules/RuleSystemSelect';
import { Loader2, ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleId, setRuleId] = useState('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState<CampaignScenarioLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void scenariosApiService
      .getScenarios({ limit: 500 })
      .then((list) => setScenarios(list.filter((s) => !s.is_session_snapshot)))
      .finally(() => setLoading(false));
  }, []);

  const filteredScenarios = ruleId
    ? scenarios.filter((s) => s.rule_id_str === ruleId)
    : scenarios;

  const addScenario = (scenarioId: string) => {
    if (selected.some((x) => x.scenario_id === scenarioId)) return;
    setSelected((prev) => [
      ...prev,
      { scenario_id: scenarioId, order_num: prev.length },
    ]);
  };

  const removeAt = (index: number) => {
    setSelected((prev) =>
      prev.filter((_, i) => i !== index).map((x, i) => ({ ...x, order_num: i })),
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= selected.length) return;
    const copy = [...selected];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    setSelected(copy.map((x, i) => ({ ...x, order_num: i })));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Укажите название');
      return;
    }
    if (selected.length === 0) {
      toast.error('Добавьте хотя бы один эпизод (сценарий)');
      return;
    }
    setSaving(true);
    try {
      const payload: CampaignCreate = {
        name: name.trim(),
        description: description.trim() || null,
        rule_id_str: ruleId || null,
        scenarios: selected,
      };
      const created = await campaignsApiService.createCampaign(payload);
      router.push(`/campaigns/${created.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Новая кампания" />
      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <Link href="/campaigns" className="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> К списку
        </Link>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">Название</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Описание</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Система (фильтр сценариев)</label>
            <RuleSystemSelect value={ruleId} onChange={setRuleId} className="mt-1" />
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="font-medium">Эпизоды (порядок игры)</h2>
          {selected.length === 0 ? (
            <p className="text-sm text-gray-500">Добавьте сценарии из списка ниже</p>
          ) : (
            <div className="space-y-2">
              {selected.map((link, i) => {
                const sc = scenarios.find((s) => s.id === link.scenario_id);
                return (
                  <div
                    key={link.scenario_id}
                    className="flex items-center gap-2 border border-gray-700 rounded-md px-3 py-2 bg-gray-950/50"
                  >
                    <GripVertical className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-xs text-gray-500 w-6">{i + 1}.</span>
                    <span className="flex-1 truncate">{sc?.name ?? link.scenario_id}</span>
                    <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => move(i, 1)}
                      disabled={i === selected.length - 1}
                    >
                      ↓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeAt(i)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-medium text-sm text-gray-400">Доступные сценарии</h2>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto border border-gray-800 rounded-md p-2">
              {filteredScenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="text-left px-3 py-2 rounded hover:bg-gray-800 flex justify-between items-center"
                  onClick={() => addScenario(s.id)}
                  disabled={selected.some((x) => x.scenario_id === s.id)}
                >
                  <span>{s.name}</span>
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </section>

        <Button onClick={() => void handleCreate()} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Создать кампанию
        </Button>
      </main>
    </div>
  );
}
