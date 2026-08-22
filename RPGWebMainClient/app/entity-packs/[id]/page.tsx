'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/app/components/layout/Header';
import { entityPacksApiService, type EntityPack } from '@/app/services/api/entityPacks';
import { useRuleSystemLabels } from '@/app/components/rules/RuleSystemSelect';
import { EntityPackTagBadges } from '@/app/components/entity-packs/EntityPackTagBadges';
import { Loader2, ArrowLeft, Pencil, Check, X } from 'lucide-react';
import { EntityPackNpcsTab } from '@/app/components/entity-packs/EntityPackNpcsTab';
import { EntityPackItemsTab } from '@/app/components/entity-packs/EntityPackItemsTab';
import { EntityPackCharactersTab } from '@/app/components/entity-packs/EntityPackCharactersTab';
import { useUrlTab } from '@/app/services/hooks/useUrlTab';
import { preloadTemplateSetPluginSchemas } from '@/app/services/preloadTemplateSetPluginSchemas';

const PACK_TABS = ['npcs', 'items', 'characters'] as const;
type PackTab = (typeof PACK_TABS)[number];

export default function EntityPackDetailPage() {
  const params = useParams();
  const packId = String(params.id ?? '');
  const ruleLabel = useRuleSystemLabels();

  const [pack, setPack] = useState<EntityPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!packId) return;
    setLoading(true);
    try {
      const row = await entityPacksApiService.getPack(packId);
      setPack(row);
      setNameDraft(row.name);
      setTagsDraft((row.tags ?? []).join(', '));
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pack?.id) return;
    void preloadTemplateSetPluginSchemas(pack.id);
  }, [pack?.id]);

  const title = useMemo(() => pack?.name ?? 'Пак', [pack?.name]);
  const [activeTab, setActiveTab] = useUrlTab<PackTab>(PACK_TABS, 'npcs');

  const saveName = async () => {
    if (!pack || !nameDraft.trim()) return;
    setSaving(true);
    try {
      const updated = await entityPacksApiService.updatePack(pack.id, { name: nameDraft.trim() });
      setPack(updated);
      setNameDraft(updated.name);
      setEditingName(false);
    } finally {
      setSaving(false);
    }
  };

  const saveTags = async () => {
    if (!pack) return;
    const tags = tagsDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const updated = await entityPacksApiService.updatePack(pack.id, { tags });
      setPack(updated);
      setTagsDraft((updated.tags ?? []).join(', '));
      setEditingTags(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" />
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-3">
        <p>Пак не найден</p>
        <Link href="/entity-packs">
          <Button variant="secondary">К списку паков</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section={title} />
      <main className="container mx-auto px-4 py-6 space-y-5">
        <Link href="/entity-packs" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Все паки
        </Link>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {editingName ? (
              <>
                <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="max-w-sm" />
                <Button size="sm" disabled={saving || !nameDraft.trim()} onClick={() => void saveName()}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameDraft(pack.name); }}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold">{pack.name}</h1>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-gray-400">Система: {ruleLabel(pack.rule_id_str)}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {editingTags ? (
              <>
                <Input
                  value={tagsDraft}
                  onChange={(e) => setTagsDraft(e.target.value)}
                  placeholder="теги через запятую, например default"
                  className="max-w-md"
                />
                <Button size="sm" disabled={saving} onClick={() => void saveTags()}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingTags(false);
                    setTagsDraft((pack.tags ?? []).join(', '));
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <EntityPackTagBadges tags={pack.tags ?? []} />
                {!(pack.tags ?? []).length ? (
                  <span className="text-xs text-gray-500">без тегов</span>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setEditingTags(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-gray-600 font-mono">{pack.id}</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PackTab)}>
          <TabsList>
            <TabsTrigger value="npcs">NPC</TabsTrigger>
            <TabsTrigger value="items">Предметы</TabsTrigger>
            <TabsTrigger value="characters">Персонажи</TabsTrigger>
          </TabsList>
          <TabsContent value="npcs" className="pt-4">
            <EntityPackNpcsTab pack={pack} />
          </TabsContent>
          <TabsContent value="items" className="pt-4">
            <EntityPackItemsTab pack={pack} />
          </TabsContent>
          <TabsContent value="characters" className="pt-4">
            <EntityPackCharactersTab pack={pack} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
