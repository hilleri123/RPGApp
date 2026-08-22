'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { scenariosApiService } from '@/app/services/api/scenario';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { ScenarioWithCounts, ScenarioTodo, TodoCreate, TodoPatch } from '@/app/services/types2';
import { getPluginUI } from '@/app/plugins/uiRegistry';
import {
  canCopyScenario,
  canDeleteScenario,
  canEditEntities,
  canEditScenarioMeta,
} from '@/app/lib/scenarioPermissions';
import type { RoleAccess } from '@/app/services/types/access_groups';
import { preloadScenarioPluginSchemas } from '@/app/services/preloadScenarioPluginSchemas';

export type TabKey =
  | 'story' | 'locations' | 'characters' | 'npcs' | 'items'
  | 'notes' | 'counters' | 'template_npcs' | 'template_characters'
  | 'template_items' | 'todos' | 'settings' | 'fronts' | 'wiki';

type ScenarioCtx = {
  scenarioId: string;
  pluginId: string | null;
  pluginUI: any;
  scenario: ScenarioWithCounts | null;
  permission: RoleAccess | undefined;
  canEditEntities: boolean;
  canEditMeta: boolean;
  canDelete: boolean;
  canCopy: boolean;
  loading: boolean;
  error: unknown;
  reloadScenario: () => Promise<void>;
  tabCounts: Record<TabKey, number>;
  setTabCount: (tab: TabKey, value: number) => void;
  incTabCount: (tab: TabKey, delta?: number) => void;
  syncTabCountsFromScenario: () => void;

  // Todo
  todos: ScenarioTodo[];
  todosLoading: boolean;
  reloadTodos: () => Promise<void>;
  createTodo: (data: TodoCreate) => Promise<ScenarioTodo>;
  patchTodo: (id: string, data: TodoPatch) => Promise<ScenarioTodo>;
  toggleTodoDone: (id: string) => Promise<ScenarioTodo>;
  deleteTodo: (id: string) => Promise<void>;
};

const Ctx = createContext<ScenarioCtx | null>(null);

export function ScenarioProvider({
  scenarioId,
  children,
}: React.PropsWithChildren<{ scenarioId: string }>) {
  const [scenario, setScenario] = useState<ScenarioWithCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [todos, setTodos] = useState<ScenarioTodo[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);

  const [tabCounts, setTabCounts] = useState<Record<TabKey, number>>({
    story: 0, locations: 0, characters: 0, npcs: 0, items: 0,
    notes: 0, counters: 0, template_npcs: 0, template_characters: 0,
    template_items: 0, todos: 0, settings: 0, fronts: 0, wiki: 0,
  });

  // Один экземпляр scoped-клиента на весь провайдер
  const scopedApi = useMemo(
    () => new ScenarioScopedApiService(scenarioId),
    [scenarioId],
  );

  const syncTabCountsFromScenario = useCallback(() => {
    if (!scenario?.counts) return;
    setTabCounts((p) => ({
      ...p,
      story:      scenario.counts.story_beats  ?? p.story,
      locations:  scenario.counts.locations    ?? p.locations,
      characters: scenario.counts.characters   ?? p.characters,
      npcs:       scenario.counts.npcs         ?? p.npcs,
      items:      scenario.counts.items        ?? p.items,
      notes:      scenario.counts.notes        ?? p.notes,
      counters:   scenario.counts.counters     ?? p.counters,
    }));
  }, [scenario]);

  const reloadScenario = useCallback(async () => {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);
    try {
      const sc = await scenariosApiService.getScenario(scenarioId);
      setScenario(sc);
    } catch (e) {
      setError(e);
      setScenario(null);
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  const reloadTodos = useCallback(async () => {
    setTodosLoading(true);
    try {
      const data = await scopedApi.getTodos({ limit: 500 });
      setTodos(data);
      setTabCounts((p) => ({ ...p, todos: data.filter((t) => !t.is_done).length }));
    } catch {
      // тихо игнорируем
    } finally {
      setTodosLoading(false);
    }
  }, [scopedApi]);

  const createTodo = useCallback(async (data: TodoCreate) => {
    const created = await scopedApi.createTodo(data);
    setTodos((p) => [created, ...p]);
    setTabCounts((p) => ({ ...p, todos: p.todos + 1 }));
    return created;
  }, [scopedApi]);

  const patchTodo = useCallback(async (id: string, data: TodoPatch) => {
    const updated = await scopedApi.patchTodo(id, data);
    setTodos((p) => p.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, [scopedApi]);

  const toggleTodoDone = useCallback(async (id: string) => {
    const updated = await scopedApi.toggleTodoDone(id);
    setTodos((p) => p.map((t) => (t.id === id ? updated : t)));
    setTabCounts((p) => ({
      ...p,
      todos: p.todos + (updated.is_done ? -1 : 1),
    }));
    return updated;
  }, [scopedApi]);

  const deleteTodo = useCallback(async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    await scopedApi.deleteTodo(id);
    setTodos((p) => p.filter((t) => t.id !== id));
    if (todo && !todo.is_done) {
      setTabCounts((p) => ({ ...p, todos: Math.max(0, p.todos - 1) }));
    }
  }, [scopedApi, todos]);

  useEffect(() => { void reloadScenario(); }, [scenarioId]);
  useEffect(() => {
    if (!scenarioId) return;
    void preloadScenarioPluginSchemas(scenarioId);
  }, [scenarioId]);
  useEffect(() => { void reloadTodos(); }, [scenarioId]);
  useEffect(() => { syncTabCountsFromScenario(); }, [scenario?.id]);

  const pluginId = useMemo(() => {
    const v = (scenario as any)?.rule_id_str ?? null;
    return v ? String(v) : null;
  }, [scenario]);

  const pluginUI = useMemo(() => (pluginId ? getPluginUI(pluginId) : null), [pluginId]);

  const permission = scenario?.permission;
  const canEdit = canEditEntities(permission);
  const canMeta = canEditScenarioMeta(permission);
  const canDel = canDeleteScenario(permission);
  const canDup = canCopyScenario(permission);

  const value = useMemo<ScenarioCtx>(() => ({
    scenarioId, pluginId, pluginUI,
    scenario, permission, canEditEntities: canEdit, canEditMeta: canMeta,
    canDelete: canDel, canCopy: canDup,
    loading, error, reloadScenario,
    tabCounts,
    setTabCount: (tab, value) => setTabCounts((p) => ({ ...p, [tab]: value })),
    incTabCount: (tab, delta = 1) => setTabCounts((p) => ({ ...p, [tab]: (p[tab] ?? 0) + delta })),
    syncTabCountsFromScenario,
    todos, todosLoading, reloadTodos,
    createTodo, patchTodo, toggleTodoDone, deleteTodo,
  }), [
    scenarioId, pluginId, pluginUI,
    scenario, permission, canEdit, canMeta, canDel, canDup,
    loading, error, reloadScenario,
    tabCounts, syncTabCountsFromScenario,
    todos, todosLoading, reloadTodos,
    createTodo, patchTodo, toggleTodoDone, deleteTodo,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScenario() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useScenario must be used within ScenarioProvider');
  return v;
}

export function useScenarioOptional() {
  return useContext(Ctx);
}