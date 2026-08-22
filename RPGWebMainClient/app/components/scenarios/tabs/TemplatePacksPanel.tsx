'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { entityPacksApiService, type EntityPack } from '@/app/services/api/entityPacks';
import type { ScenarioWithCounts } from '@/app/services/types2';
import { ExternalLink } from 'lucide-react';
import { EntityPackTagBadges } from '@/app/components/entity-packs/EntityPackTagBadges';
import { isDefaultPack } from '@/app/components/entity-packs/entityPackUtils';

type Props = {
  scenario: ScenarioWithCounts;
  canEdit: boolean;
  onChanged: () => void;
};

export function TemplatePacksPanel({ scenario, canEdit, onChanged }: Props) {
  const [packs, setPacks] = useState<EntityPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [hideDefaultPacks, setHideDefaultPacks] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    if (scenario.template_set_id) ids.add(String(scenario.template_set_id));
    for (const id of scenario.linked_template_set_ids ?? []) ids.add(String(id));
    return ids;
  }, [scenario.template_set_id, scenario.linked_template_set_ids]);

  const load = useCallback(async () => {
    if (!scenario.rule_id_str) return;
    setLoading(true);
    try {
      const rows = await entityPacksApiService.listForRule(scenario.rule_id_str);
      setPacks(rows);
    } finally {
      setLoading(false);
    }
  }, [scenario.rule_id_str]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePack = async (packId: string, linked: boolean) => {
    if (!canEdit) return;
    setBusyId(packId);
    try {
      if (linked) {
        await entityPacksApiService.unlinkPackFromScenario(scenario.id, packId);
      } else {
        await entityPacksApiService.linkPackToScenario(scenario.id, packId);
      }
      onChanged();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const createAndLink = async () => {
    if (!canEdit || !scenario.rule_id_str || !newPackName.trim()) return;
    setBusyId('create');
    try {
      const pack = await entityPacksApiService.createPack(scenario.rule_id_str, newPackName.trim());
      await entityPacksApiService.linkPackToScenario(scenario.id, pack.id);
      setNewPackName('');
      await load();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const linkExisting = async (packId: string) => {
    if (!canEdit || linkedIds.has(packId)) return;
    setBusyId(packId);
    try {
      await entityPacksApiService.linkPackToScenario(scenario.id, packId);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const unlinkedPacks = packs
    .filter((p) => !linkedIds.has(p.id))
    .filter((p) => !hideDefaultPacks || !isDefaultPack(p));

  const linkedPacks = packs.filter((p) => linkedIds.has(p.id));

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Паки шаблонов сценария</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Подключите паки с шаблонными NPC, предметами и персонажами. Отдельные шаблоны можно
            добавить во вкладках «Шаблоны».
          </p>
        </div>
        <Link href="/entity-packs">
          <Button type="button" variant="secondary" size="sm">
            <ExternalLink className="w-4 h-4 mr-1" /> Управление паками
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка паков…</p>
      ) : packs.length === 0 ? (
        <p className="text-sm text-gray-400">Нет паков для этой системы правил.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Подключённые</p>
          {linkedPacks.map((pack) => {
            const isPrimary = String(scenario.template_set_id) === pack.id;
            return (
              <label
                key={pack.id}
                className="flex items-center gap-3 rounded-lg border border-white/5 px-3 py-2 hover:bg-white/5"
              >
                <Checkbox
                  checked
                  disabled={!canEdit || busyId === pack.id || isPrimary}
                  onCheckedChange={() => togglePack(pack.id, true)}
                />
                <div className="flex-1 min-w-0">
                  <Link href={`/entity-packs/${pack.id}`} className="text-sm text-gray-100 hover:underline truncate block">
                    {pack.name}
                  </Link>
                  <EntityPackTagBadges tags={pack.tags ?? []} className="mt-1" />
                </div>
                {isPrimary ? (
                  <span className="text-xs text-amber-400/90 shrink-0">основной</span>
                ) : null}
              </label>
            );
          })}

          {unlinkedPacks.length > 0 || packs.some((p) => !linkedIds.has(p.id) && isDefaultPack(p)) ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Доступные для подключения</p>
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <Checkbox
                    checked={hideDefaultPacks}
                    onCheckedChange={(v) => setHideDefaultPacks(v === true)}
                  />
                  Скрыть паки по умолчанию
                </label>
              </div>
              {unlinkedPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-white/10 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <Link href={`/entity-packs/${pack.id}`} className="text-sm text-gray-300 hover:underline truncate block">
                      {pack.name}
                    </Link>
                    <EntityPackTagBadges tags={pack.tags ?? []} className="mt-1" />
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === pack.id}
                      onClick={() => void linkExisting(pack.id)}
                    >
                      Подключить
                    </Button>
                  ) : null}
                </div>
              ))}
              {unlinkedPacks.length === 0 && hideDefaultPacks ? (
                <p className="text-xs text-gray-500">Все доступные паки скрыты фильтром.</p>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {canEdit ? (
        <div className="flex gap-2 pt-2 border-t border-white/10">
          <Input
            placeholder="Новый пак…"
            value={newPackName}
            onChange={(e) => setNewPackName(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!newPackName.trim() || busyId === 'create'}
            onClick={() => void createAndLink()}
          >
            Создать и подключить
          </Button>
        </div>
      ) : null}
    </div>
  );
}
