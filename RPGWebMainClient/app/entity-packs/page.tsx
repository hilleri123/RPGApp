'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Header from '@/app/components/layout/Header';
import { RuleSystemSelect, useRuleSystemLabels } from '@/app/components/rules/RuleSystemSelect';
import { entityPacksApiService, type EntityPack } from '@/app/services/api/entityPacks';
import { EntityPackTagBadges } from '@/app/components/entity-packs/EntityPackTagBadges';
import { isDefaultPack } from '@/app/components/entity-packs/entityPackUtils';
import { Loader2, Plus, ChevronRight, Package } from 'lucide-react';

export default function EntityPacksPage() {
  const router = useRouter();
  const ruleLabel = useRuleSystemLabels();
  const [ruleId, setRuleId] = useState('');
  const [packs, setPacks] = useState<EntityPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hideDefaultPacks, setHideDefaultPacks] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ruleId) {
      setPacks([]);
      return;
    }
    setLoading(true);
    try {
      setPacks(await entityPacksApiService.listForRule(ruleId));
    } finally {
      setLoading(false);
    }
  }, [ruleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return packs
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => !hideDefaultPacks || !isDefaultPack(p));
  }, [packs, search, hideDefaultPacks]);

  const createPack = async () => {
    if (!ruleId || !newName.trim()) return;
    setBusy(true);
    try {
      const pack = await entityPacksApiService.createPack(ruleId, newName.trim());
      setNewName('');
      await load();
      router.push(`/entity-packs/${pack.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Паки шаблонов" />
      <main className="container mx-auto px-4 py-6 space-y-5">
        <p className="text-sm text-gray-400 max-w-3xl">
          Паки — это наборы шаблонных NPC, предметов и персонажей для одной системы правил.
          Их можно подключать к сценариям целиком или по отдельным шаблонам.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <RuleSystemSelect
            value={ruleId}
            onChange={setRuleId}
            allowEmpty={false}
            label="Система правил"
            className="min-w-[220px]"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени…"
            className="max-w-xs"
            disabled={!ruleId}
          />
          <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
            <Checkbox
              checked={hideDefaultPacks}
              onCheckedChange={(v) => setHideDefaultPacks(v === true)}
              disabled={!ruleId}
            />
            Скрыть паки по умолчанию
          </label>
        </div>

        {ruleId ? (
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-white/10">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название нового пака…"
              className="max-w-sm"
            />
            <Button type="button" disabled={!newName.trim() || busy} onClick={() => void createPack()}>
              <Plus className="w-4 h-4 mr-1" /> Создать пак
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin" />
          </div>
        ) : !ruleId ? (
          <p className="text-gray-500 text-sm">Выберите систему правил, чтобы увидеть паки.</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {packs.length > 0 && hideDefaultPacks
              ? 'Нет паков с текущим фильтром — снимите «Скрыть паки по умолчанию».'
              : 'Паков пока нет — создайте первый.'}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((pack) => (
              <Link
                key={pack.id}
                href={`/entity-packs/${pack.id}`}
                className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-violet-500/15 p-2">
                    <Package className="w-5 h-5 text-violet-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{pack.name}</div>
                    <EntityPackTagBadges tags={pack.tags ?? []} className="mt-2" />
                    <div className="text-xs text-gray-500 mt-1">{ruleLabel(pack.rule_id_str)}</div>
                    <div className="text-[11px] text-gray-600 font-mono truncate mt-1">{pack.id}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
