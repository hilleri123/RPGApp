'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { MASTER_ROLE, type SessionActionBase } from '@/app/services/types/session';
import type { EntityKind, Issue } from '@/app/services/types2';



export function wrapLoadedToForm(loaded: any, resolvedInitialForm: any) {
  return {
    ...resolvedInitialForm,
    ...loaded,
    force: false,
    data: loaded?.data ?? {},
    owned_items: loaded?.owned_items ?? [],
    take_from_other_owner_ids: loaded?.take_from_other_owner_ids ?? [],
    sublocations: loaded?.sublocations ?? [],
    map_objects: loaded?.map_objects ?? [],
    scene_exposures: loaded?.scene_exposures ?? [],
  };
}

export function buildObjectFromForm(form: any) {
  const {
    take_from_other_owner_ids: _take,
    ...payload
  } = form;

  return {
    ...payload,
    sublocations: form.sublocations ?? [],
    map_objects: form.map_objects ?? [],
    scene_exposures: form.scene_exposures ?? [],
    owned_items: form.owned_items ?? [],
  };
}


type ValidateResult = { ok: boolean; issues: Issue[]; data?: any };

export type SessionEntityDialogResult<TForm, TAssets> = {
  pluginUI: any;

  loading: boolean;
  initialLoading: boolean;
  rulesLoading: boolean;
  configLoading: boolean;

  issues: Issue[];
  error: string | null;

  config: any | null;
  configs: Partial<Record<EntityKind, any>>;

  form: TForm;
  setForm: React.Dispatch<React.SetStateAction<TForm>>;

  assets: TAssets;
  setAssets: React.Dispatch<React.SetStateAction<TAssets>>;

  lookups: any;
  loadLookups?: (sceneId: string | null) => Promise<any> | any;

  data: any;
  setData: (next: any) => void;

  disableSave: boolean;
  validate: () => Promise<ValidateResult>;
  save: (force: boolean) => Promise<void>;

  sceneId: string | null;
  entity: EntityKind;
  entityId: string | null;
};

export function useSessionEntityDialog<
  TForm extends Record<string, any>,
  TAssets = undefined
>(opts: {
  open: boolean;
  entity: EntityKind;

  initialAssets?: TAssets;

  entityId?: string | null;

  initialForm: TForm;
  disableSave?: (form: TForm, sceneId: string | null) => boolean;
  onSaved?: () => void;

  saveImpl?: (sceneId: string, payload: TForm & { force?: boolean }) => Promise<any> | void;
  loadImpl?: (sceneId: string, entityId: string) => Promise<Partial<TForm> | null> | Partial<TForm> | null;

  loadLookups?: (sceneId: string | null) => Promise<any> | any;

  editorConfigContext?: (sceneId: string | null) => any;
  rulesContext?: (sceneId: string | null, form: TForm) => any;
}): SessionEntityDialogResult<TForm, TAssets> {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { sendRequest, pluginUI, connected } = useSessionWebSocket(sessionId);
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);

  const initialFormRef = useRef<any>(
    wrapLoadedToForm(
      { ...opts.initialForm, sublocations: [], map_objects: [] },
      {}
    )
  );
  const resolvedInitialForm = initialFormRef.current;
  // Добавь сразу после объявления opts параметра, перед useState
  const disableSaveFnRef = useRef(opts.disableSave);
  const saveImplRef = useRef(opts.saveImpl);
  const loadImplRef = useRef(opts.loadImpl);
  const loadLookupsRef = useRef(opts.loadLookups);
  const editorConfigContextRef = useRef(opts.editorConfigContext);
  const rulesContextRef = useRef(opts.rulesContext);
  const onSavedRef = useRef(opts.onSaved);

  // Обновляй refs на каждый рендер (без триггера ре-рендера)
  disableSaveFnRef.current = opts.disableSave;
  saveImplRef.current = opts.saveImpl;
  loadImplRef.current = opts.loadImpl;
  loadLookupsRef.current = opts.loadLookups;
  editorConfigContextRef.current = opts.editorConfigContext;
  rulesContextRef.current = opts.rulesContext;
  onSavedRef.current = opts.onSaved;


  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [configs, setConfigs] = useState<Partial<Record<EntityKind, any>>>({});

  const [form, setForm] = useState<TForm>(() => resolvedInitialForm);
  const [assets, setAssets] = useState<TAssets>(opts?.initialAssets ?? ({} as TAssets));

  const [lookups, setLookups] = useState<any>({});

  const editorConfigCacheRef = useRef<Map<string, any>>(new Map());
  const editorConfigInFlightRef = useRef<Map<string, Promise<any>>>(new Map());

  const data = (form as any)?.data;
  const setData = useCallback((next: any) => {
    setForm((p) => ({ ...p, data: next }));
  }, []);

  const object = buildObjectFromForm(form);

  // disableSave
  const [disableSave, setDisableSave] = useState(false);

  useEffect(() => {
    const next =
      opts.disableSave?.(object, currentSceneId) ??
      (!currentSceneId || !String(object.name ?? '').trim());

    setDisableSave(next);
  }, [form, currentSceneId, opts.disableSave]);


  // reset / load form on open or entityId change
  useEffect(() => {
    if (!opts.open) return;

    const entityId =
      typeof opts.entityId === 'string' && opts.entityId.trim() ? opts.entityId : null;

    if (!entityId) {
      setForm(resolvedInitialForm);
      setIssues([]);
      setError(null);
      return;
    }

    setInitialLoading(true);
    setIssues([]);
    setError(null);

    (async () => {
      try {
        if (!connected || !currentSceneId) return;
        if (!opts.loadImpl) return;

        if (!loadImplRef.current) return;
        const loaded = await loadImplRef.current(currentSceneId, entityId);
        setForm(loaded ? wrapLoadedToForm(loaded, resolvedInitialForm) : resolvedInitialForm);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setInitialLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.open, opts.entityId, currentSceneId, connected]);

  useEffect(() => {
    if (!opts.open) return;

    let cancelled = false;

    (async () => {
      try {
        const loaded = loadLookupsRef.current
          ? await loadLookupsRef.current(currentSceneId)
          : {};
        if (!cancelled) setLookups(loaded ?? {});
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setLookups({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opts.open, currentSceneId]);

  // editor config
  const editorConfigKey = useMemo(() => {
    if (!opts.open || !connected || !currentSceneId) return null;
    return `${opts.entity}::${currentSceneId}`;
  }, [opts.open, connected, currentSceneId, opts.entity]);

  const loadEditorConfig = useCallback(async () => {
    if (!editorConfigKey) return;

    if (editorConfigCacheRef.current.has(editorConfigKey)) {
      const cached = editorConfigCacheRef.current.get(editorConfigKey);
      setConfig(cached);
      setConfigs({ [opts.entity]: cached });
      return;
    }

    const inFlight = editorConfigInFlightRef.current.get(editorConfigKey);
    if (inFlight) {
      await inFlight;
      const cached = editorConfigCacheRef.current.get(editorConfigKey) ?? null;
      setConfig(cached);
      setConfigs({ [opts.entity]: cached });
      return;
    }

    setConfigLoading(true);
    setError(null);

    const p = (async () => {
      try {
        const context = editorConfigContextRef.current?.(currentSceneId) ?? { scene_id: currentSceneId };

        const action: SessionActionBase = {
          user_role: MASTER_ROLE,
          msg_type: 'editor_config' as any,
          entity: opts.entity as any,
          scene_id: currentSceneId as any,
          context,
        } as any;

        const res = await sendRequest(action);
        const cfg = (res as any)?.data?.config ?? (res as any)?.config ?? null;

        editorConfigCacheRef.current.set(editorConfigKey, cfg);
        setConfig(cfg);
        setConfigs({ [opts.entity]: cfg });
      } catch (e: any) {
        setError(e?.message ?? String(e));
        editorConfigCacheRef.current.set(editorConfigKey, null);
        setConfig(null);
        setConfigs({});
      } finally {
        editorConfigInFlightRef.current.delete(editorConfigKey);
        setConfigLoading(false);
      }
    })();

    editorConfigInFlightRef.current.set(editorConfigKey, p);
    await p;
  }, [editorConfigKey, opts.entity, currentSceneId, sendRequest]);

  useEffect(() => {
    void loadEditorConfig();
  }, [loadEditorConfig]);

  const validate = useCallback(async (): Promise<ValidateResult> => {
    if (!currentSceneId) {
      const res: ValidateResult = { ok: false, issues: [{ message: 'Нет выбранной сцены' } as Issue] };
      setIssues(res.issues);
      return res;
    }

    setRulesLoading(true);
    setError(null);

    try {
      const context = rulesContextRef.current?.(currentSceneId, form) ?? { scene_id: currentSceneId };

      const action: SessionActionBase = {
        user_role: MASTER_ROLE,
        msg_type: 'validate_entity' as any,
        entity: opts.entity as any,
        scene_id: currentSceneId as any,
        context,
        data: (form as any)?.data ?? {},
      } as any;

      const res = await sendRequest(action);
      const nextIssues: Issue[] = (res as any)?.issues ?? [];

      setIssues(nextIssues);

      if ((res as any)?.data !== undefined) {
        setForm((p) => ({ ...p, data: (res as any).data }));
      }

      return { ok: !!(res as any)?.ok, issues: nextIssues, data: (res as any)?.data };
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setIssues([]);
      return { ok: false, issues: [] };
    } finally {
      setRulesLoading(false);
    }
  }, [sendRequest, currentSceneId, opts.entity, form]);

  const save = useCallback(
    async (force: boolean) => {
      if (!currentSceneId || disableSave) return;
      if (!opts.saveImpl) {
        console.warn('[EntityDialog] saveImpl is not provided');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const v = await validate();
        if (!v.ok && !force) return;
        // console.info(v)

        // в save:
        if (!saveImplRef.current) return ;
        await saveImplRef.current(currentSceneId, { ...object, data: v.data, force } as any);
        onSavedRef.current?.();

        opts.onSaved?.();
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    [currentSceneId, disableSave, form, validate]
  );

  return useMemo(
    () => ({
      pluginUI,
      loading,
      initialLoading,
      rulesLoading,
      configLoading,
      issues,
      error,
      config,
      configs,
      data,
      setData,
      form,
      setForm,
      assets,
      setAssets,
      lookups,
      disableSave,
      validate,
      save,
      sceneId: currentSceneId,
      entity: opts.entity,
      entityId: opts.entityId ?? null,
    }),
    [
      pluginUI,
      loading,
      initialLoading,
      rulesLoading,
      configLoading,
      issues,
      error,
      config,
      configs,
      data,
      setData,
      form,
      assets,
      setAssets,
      lookups,
      disableSave,
      validate,
      save,
      currentSceneId,
      opts.entity,
      opts.entityId,
    ]
  );
}
