'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Issue } from '@/app/services/types2';
import type { EntityKind } from '@/app/services/types2';
import { RuleTemplatesApiService } from '../../api/templates';
import { loadPluginEditorConfigs } from '@/app/services/loadPluginEditorConfigs';


function makeRuleTemplatesApiService(templateSetId: string) {
  return new RuleTemplatesApiService(templateSetId);
}

export type ValidateResult = {
  ok: boolean;
  issues: Issue[];
  data?: any;
};

export type TemplateObjectDialogResult<TOut, TForm, TLookups, TAssets> = {
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

  // rules
  config: any | null;
  configs: Partial<Record<EntityKind, any>>;

  issues: Issue[];
  data: any;
  setData: (next: any) => void;
  validate: () => Promise<ValidateResult>;

  reload: () => Promise<void>;
  save: (force?: boolean) => Promise<any>;
};

export function useTemplateObjectDialog<
  TOut,
  TPayload,
  TLookups,
  TForm = TPayload,
  TAssets = undefined
>(opts: {
  open: boolean;

  templateSetId: string;

  objectId: string | null;

  onSaved?: (id: string) => void;

  empty: () => { form: TForm; assets: TAssets; lookups?: TLookups };

  loadFull: (api: RuleTemplatesApiService, id: string) => Promise<TOut>;
  loadLookups: (api: RuleTemplatesApiService) => Promise<TLookups>;

  init: (full: TOut | null, lookups: TLookups) => { form: TForm; assets: TAssets };

  buildPayload: (form: TForm, force: boolean, assets: TAssets) => TPayload;

  create: (api: RuleTemplatesApiService, payload: TPayload, assets: TAssets) => Promise<any>;
  update: (api: RuleTemplatesApiService, id: string, payload: TPayload, assets: TAssets) => Promise<any>;

  rules?: {
    loadConfigFor?: EntityKind[];
    context?: Record<string, any>;
    optionsContext?: (form: TForm) => Record<string, any>;
    validate?: (api: RuleTemplatesApiService, form: TForm) => Promise<ValidateResult>;
  };
}): TemplateObjectDialogResult<TOut, TForm, TLookups, TAssets> {
  const {
    open,
    templateSetId,
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

  const api = useMemo(() => makeRuleTemplatesApiService(templateSetId), [templateSetId]);
  const emptyState = useMemo(() => empty(), [empty]);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookups, setLookups] = useState<TLookups>((emptyState.lookups ?? ({} as TLookups)) as TLookups);
  const [full, setFull] = useState<TOut | null>(null);

  const [form, setForm] = useState<TForm>(() => emptyState.form);
  const [assets, setAssets] = useState<TAssets>(() => emptyState.assets);

  // rules
  const [configs, setConfigs] = useState<Partial<Record<EntityKind, any>>>({});
  const [issues, setIssues] = useState<Issue[]>([]);

  const rulesRef = useRef(rules);
  rulesRef.current = rules;

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

  const loadRulesConfigsRef = useRef<
    (optsCtx: Record<string, any>, withOptions: boolean) => Promise<void>
  >(async () => {});

  const rulesLoadedKeyRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, templateSetId, objectId]); // специально без reload

  const loadRulesConfigs = useCallback(
    async (optsCtx: Record<string, any>, withOptions: boolean) => {
      const kinds = (configKindsKey ? configKindsKey.split(',') : []) as EntityKind[];
      if (!kinds.length) {
        setConfigs({});
        return;
      }

      const scope = { scope: 'template_set' as const, id: templateSetId };
      const initContext = rulesRef.current?.context ?? {};

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
    [api, objectId, templateSetId, configKindsKey],
  );

  loadRulesConfigsRef.current = loadRulesConfigs;

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

    const loadKey = `${templateSetId}:${objectId ?? 'new'}:${configKindsKey}`;
    if (rulesLoadedKeyRef.current === loadKey) return;

    let cancelled = false;

    (async () => {
      setRulesLoading(true);
      try {
        await loadRulesConfigsRef.current({}, false);
        if (!cancelled) {
          rulesLoadedKeyRef.current = loadKey;
        }
      } catch (e: any) {
        if (!cancelled) {
          setConfigs({});
          setError((prev) => prev ?? e?.message ?? 'Не удалось загрузить редактор правил');
        }
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, templateSetId, objectId, configKindsKey]);

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
  }, [open, templateSetId, optionsContextKey, configKindsKey]);

  const config = useMemo(() => {
    const kinds = rules?.loadConfigFor ?? [];
    const first = kinds[0];
    return first ? configs[first] ?? null : null;
  }, [configs, rules?.loadConfigFor]);

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
          res?.character?.id ??
          res?.location?.id ??
          res?.counter?.id ??
          res?.note?.id ??
          res?.story_beat?.id ??
          null;

        if (Array.isArray(res?.issues)) {
          setIssues(res.issues as Issue[]);
        }

        if ((force || res?.issues?.length == 0 || res?.id) && onSaved) {
          onSaved(String(id));
        }

        return res;
      } catch (e: any) {
        setError(e?.message ?? String(e));
        return { ok: false, error: e?.message ?? String(e) };
      } finally {
        setLoading(false);
      }
    },
    [api, assets, form, objectId, buildPayload, create, update, onSaved],
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

    issues,
    data,
    setData,
    validate,

    reload,
    save,
  };
}
