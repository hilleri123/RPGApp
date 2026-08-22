'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { namePacksApiService, type NamePack } from '@/app/services/api/namePacks';
import type { ScenarioWithCounts } from '@/app/services/types2';
import { ExternalLink } from 'lucide-react';
import { EntityPackTagBadges } from '@/app/components/entity-packs/EntityPackTagBadges';

type Props = {
  scenario: ScenarioWithCounts;
  canEdit: boolean;
  onChanged: () => void;
};

export function NamePacksPanel({ scenario, canEdit, onChanged }: Props) {
  const [packs, setPacks] = useState<NamePack[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const linkedIds = useMemo(() => {
    return new Set((scenario.linked_name_pack_ids ?? []).map(String));
  }, [scenario.linked_name_pack_ids]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPacks(await namePacksApiService.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePack = async (packId: string, linked: boolean) => {
    if (!canEdit) return;
    setBusyId(packId);
    try {
      if (linked) {
        await namePacksApiService.unlinkFromScenario(scenario.id, packId);
      } else {
        await namePacksApiService.linkToScenario(scenario.id, packId);
      }
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const createAndLink = async () => {
    if (!canEdit || !newPackName.trim()) return;
    setBusyId('create');
    try {
      const pack = await namePacksApiService.createPack(newPackName.trim());
      await namePacksApiService.linkToScenario(scenario.id, pack.id);
      setNewPackName('');
      await load();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const linkedPacks = packs.filter((p) => linkedIds.has(p.id));
  const unlinkedPacks = packs.filter((p) => !linkedIds.has(p.id));

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Паки имён</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Нарративные наборы имён (не зависят от системы правил). Подключите паки к этому сценарию.
          </p>
        </div>
        <Link href="/name-packs">
          <Button type="button" variant="secondary" size="sm">
            <ExternalLink className="w-4 h-4 mr-1" /> Редактор паков
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка…</p>
      ) : packs.length === 0 ? (
        <p className="text-sm text-gray-400">Нет паков имён. Создайте в разделе «Имена».</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Подключённые</p>
          {linkedPacks.length === 0 ? (
            <p className="text-xs text-gray-500">Ни один пак не подключён — работает только встроенный codex.</p>
          ) : (
            linkedPacks.map((pack) => (
              <label
                key={pack.id}
                className="flex items-center gap-3 rounded-lg border border-white/5 px-3 py-2 hover:bg-white/5"
              >
                <Checkbox
                  checked
                  disabled={!canEdit || busyId === pack.id}
                  onCheckedChange={() => togglePack(pack.id, true)}
                />
                <div className="flex-1 min-w-0">
                  <Link href={`/name-packs/${pack.id}`} className="text-sm text-gray-100 hover:underline truncate block">
                    {pack.name}
                  </Link>
                  <EntityPackTagBadges tags={pack.tags ?? []} className="mt-1" />
                </div>
              </label>
            ))
          )}

          {unlinkedPacks.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide pt-2">Доступные</p>
              {unlinkedPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-white/10 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <Link href={`/name-packs/${pack.id}`} className="text-sm text-gray-300 hover:underline truncate block">
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
                      onClick={() => void togglePack(pack.id, false)}
                    >
                      Подключить
                    </Button>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}

      {canEdit ? (
        <div className="flex gap-2 pt-2 border-t border-white/10">
          <Input
            placeholder="Новый пак имён…"
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
