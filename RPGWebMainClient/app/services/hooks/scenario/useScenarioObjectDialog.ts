'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import { loadPluginEditorConfigs } from '@/app/services/loadPluginEditorConfigs';
import {
  getNameGeneratorEntries,
  type NameGeneratorEntry,
} from '@/app/components/scenarios/dialogs/common/nameGenerators';
import type { EntityKind, Issue } from '@/app/services/types2';

const EMPTY_RULES_CONTEXT: Record<string, any> = {};

function makeScenarioScopedApiService(scenarioId: string) {
  return new ScenarioScopedApiService(scenarioId);
}

export type ValidateResult = {
  ok: boolean;
  issues: Issue[];
  data?: any;
};

export type ScenarioObjectDialogResult<TOut, TForm, TLookups, TAssets> = {
  loading: boolean;
  initialLoading: boolean;
  rulesLoading: boolean;
  error: string | null;

  lookups: TLookups;
  full: TOut | null;

  form: TForm;
  setForm: React.Dispatch<React.SetStateAction<TForm>>;

  assets: TAssets;
  setAssets: React.Dispatch<React.SetStateAction<TAssets>>;

  config: any | null;
  configs: Partial<Record<EntityKind, any>>;
  nameGeneratorEntries: NameGeneratorEntry[];

  issues: Issue[];
  data: any;
  setData: (next: any) => void;
  validate: () => Promise<ValidateResult>;

  reload: () => Promise<void>;
  save: (force?: boolean) => Promise<any>;

  reloadLookups: () => Promise<void>;
};

export function useScenarioObjectDialog<
  TOut,
  TPayload,
  TLookups,
  TForm = TPayload,
  TAssets = undefined
>(opts: {
  open: boolean;
  scenarioId: string;
  objectId: string | null;

  onSaved?: (id: string) => void | Promise<void>;

  empty: () => { form: TForm; assets: TAssets; lookups?: TLookups };

  loadFull: (api: ScenarioScopedApiService, id: string) => Promise<TOut>;
  loadLookups: (api: ScenarioScopedApiService) => Promise<TLookups>;

  init: (full: TOut | null, lookups: TLookups) => { form: TForm; assets: TAssets };

  buildPayload: (form: TForm, force: boolean, assets: TAssets) => TPayload;

  create: (api: ScenarioScopedApiService, payload: TPayload, assets: TAssets) => Promise<any>;
  update: (api: ScenarioScopedApiService, id: string, payload: TPayload, assets: TAssets) => Promise<any>;

  rules?: {
    loadConfigFor?: EntityKind[];
    context?: Record<string, any>;
    optionsContext?: (form: TForm) => Record<string, any>;
    validate?: (api: ScenarioScopedApiService, form: TForm) => Promise<ValidateResult>;
  };
}): ScenarioObjectDialogResult<TOut, TForm, TLookups, TAssets> {
  const {
    open,
    scenarioId,
    objectId,
    onSaved,
    empty,
    loadFull,
    loadLookups,
    init,
    buildPayload,
    create,
    update,
    rules,
  } = opts;

  const api = useMemo(() => makeScenarioScopedApiService(scenarioId), [scenarioId]);
  const emptyState = useMemo(() => empty(), [empty]);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookups, setLookups] = useState<TLookups>((emptyState.lookups ?? ({} as TLookups)) as TLookups);
  const [full, setFull] = useState<TOut | null>(null);

  const [form, setForm] = useState<TForm>(() => emptyState.form);
  const [assets, setAssets] = useState<TAssets>(() => emptyState.assets);

  const [configs, setConfigs] = useState<Partial<Record<EntityKind, any>>>({});
  const [packNameEntries, setPackNameEntries] = useState<NameGeneratorEntry[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);

  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  const loadRulesConfigsRef = useRef<
    (optsCtx: Record<string, any>, withOptions: boolean) => Promise<void>
  >(async () => {});

  const playbookId = (form as any)?.data?.playbook_id ?? null;
  const level = (form as any)?.data?.level ?? null;

  const optionsContext = useMemo(() => {
    if (!rulesRef.current?.optionsContext) return {};
    return rulesRef.current.optionsContext(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by options-affecting fields only
  }, [playbookId, level]);

  const optionsContextKey = useMemo(() => JSON.stringify(optionsContext ?? {}), [optionsContext]);
  const optionsLoadedKeyRef = useRef<string | null>(null);

  const configKindsKey = useMemo(
    () => (rules?.loadConfigFor ?? []).join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable key from kind list
    [(rules?.loadConfigFor ?? []).join(',')],
  );

  const data = (form as any)?.data;
  const setData = useCallback((next: any) => setForm((p: any) => ({ ...p, data: next })), [setForm]);

  const reload = useCallback(async () => {
    if (!open) return;

    setInitialLoading(true);
    setLoading(true);
    setError(null);

    try {
      const lk = await loadLookups(api);
      setLookups(lk);

      const f = objectId ? await loadFull(api, objectId) : null;
      setFull(f);

      const initRes = init(f, lk);
      setForm(initRes.form);
      setAssets(initRes.assets);

      setIssues([]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [open, api, objectId, loadLookups, loadFull, init]);

  const reloadLookups = useCallback(async () => {
    if (!open) return;
    try {
      const lk = await loadLookups(api);
      setLookups(lk);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [loadLookups]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, scenarioId, objectId]);

  useEffect(() => {
    if (!open) {
      setPackNameEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getScenarioNamePackEntries();
        if (cancelled) return;
        const rows: NameGeneratorEntry[] = (res.entries ?? []).map((e) => ({
          name: String(e.name ?? ''),
          tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
          description: e.description ? String(e.description) : undefined,
          part_kind: (e.part_kind as NameGeneratorEntry['part_kind']) ?? 'full',
          source: 'pack',
        }));
        setPackNameEntries(rows);
      } catch {
        if (!cancelled) setPackNameEntries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scenarioId, api]);

  const loadRulesConfigs = useCallback(
    async (optsCtx: Record<string, any>, withOptions: boolean) => {
      const kinds = (configKindsKey ? configKindsKey.split(',') : []) as EntityKind[];
      if (!kinds.length) {
        setConfigs({});
        return;
      }

      const scope = { scope: 'scenario' as const, id: scenarioId };
      const initContext = rulesRef.current?.context ?? EMPTY_RULES_CONTEXT;

      const dict = await loadPluginEditorConfigs({
        scope,
        kinds,
        needInit: !objectId,
        initContext,
        optionsContext: withOptions ? optsCtx : {},
        fetchSchema: (entity, etag) => api.getEntitySchema(entity, etag),
        fetchInit: (entity, ctx) => api.getEntityInit(entity, ctx),
        fetchOptions: (entity, ctx) => api.getEntityOptions(entity, ctx),
      });

      setConfigs((prev) => {
        const next = { ...prev };
        for (const [k, cfg] of Object.entries(dict)) {
          next[k as EntityKind] = cfg;
        }
        return next;
      });
    },
    [api, objectId, scenarioId, configKindsKey],
  );

  loadRulesConfigsRef.current = loadRulesConfigs;

  const rulesLoadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      rulesLoadedKeyRef.current = null;
      optionsLoadedKeyRef.current = null;
      return;
    }

    if (!configKindsKey) {
      setConfigs({});
      return;
    }

    const loadKey = `${scenarioId}:${objectId ?? 'new'}:${configKindsKey}`;
    if (rulesLoadedKeyRef.current === loadKey) return;

    let cancelled = false;

    (async () => {
      setRulesLoading(true);
      try {
        await loadRulesConfigsRef.current({}, false);
        if (!cancelled) {
          rulesLoadedKeyRef.current = loadKey;
        }
      } catch {
        if (!cancelled) setConfigs({});
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, scenarioId, objectId, configKindsKey]);

  useEffect(() => {
    if (!open || !rulesRef.current?.optionsContext) return;
    if (!Object.keys(optionsContext).length) return;
    if (!configKindsKey) return;

    if (optionsLoadedKeyRef.current === optionsContextKey) return;

    let cancelled = false;

    (async () => {
      setRulesLoading(true);
      try {
        await loadRulesConfigsRef.current(optionsContext, true);
        if (!cancelled) optionsLoadedKeyRef.current = optionsContextKey;
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, configKindsKey, optionsContextKey]);

  const config = useMemo(() => {
    const first = configKindsKey.split(',')[0] as EntityKind | undefined;
    return first ? configs[first] ?? null : null;
  }, [configs, configKindsKey]);

  const nameGeneratorEntries = useMemo(
    () => getNameGeneratorEntries(config, packNameEntries),
    [config, packNameEntries],
  );

  const validate = useCallback(async (): Promise<ValidateResult> => {
    if (!rules?.validate) return { ok: true, issues: [] };

    setRulesLoading(true);
    setError(null);

    try {
      const res = await rules.validate(api, form);

      const nextIssues = (res?.issues ?? []) as Issue[];
      setIssues(nextIssues);

      if (res?.data !== undefined) {
        setForm((p: any) => ({ ...p, data: res.data }));
      }

      return { ok: !!res?.ok, issues: nextIssues, data: res?.data };
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setIssues([]);
      return { ok: false, issues: [] };
    } finally {
      setRulesLoading(false);
    }
  }, [api, form, rules?.validate]);

  const save = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);

      try {
        const payload = buildPayload(form, !!force, assets);

        const res = objectId ? await update(api, objectId, payload, assets) : await create(api, payload, assets);

        const id =
          res?.id ??
          res?.item?.id ??
          res?.npc?.id ??
          res?.location?.id ??
          res?.counter?.id ??
          res?.note?.id ??
          res?.story_beat?.id ??
          null;

        if (Array.isArray(res?.issues)) {
          setIssues(res.issues as Issue[]);
        }

        const savedId = id != null && id !== '' ? String(id) : null;
        const issuesLen = Array.isArray(res?.issues) ? res.issues.length : 0;
        if (onSaved && savedId && (force || issuesLen === 0 || Boolean(res?.id))) {
          await onSaved(savedId);
        }

        return res;
      } catch (e: any) {
        setError(e?.message ?? String(e));
        return { ok: false, error: e?.message ?? String(e) };
      } finally {
        setLoading(false);
      }
    },
    [api, assets, form, objectId, buildPayload, create, update, onSaved]
  );

  return {
    loading,
    initialLoading,
    rulesLoading,
    error,

    lookups,
    full,

    form,
    setForm,

    assets,
    setAssets,

    config,
    configs,
    nameGeneratorEntries,

    issues,
    data,
    setData,
    validate,

    reload,
    save,

    reloadLookups,
  };
}
