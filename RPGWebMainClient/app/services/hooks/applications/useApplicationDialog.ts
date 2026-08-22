// app/services/hooks/applications/useApplicationDialog.ts
'use client';

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { applicationApiService } from '@/app/services/api/application';
import { loadPluginEditorConfigForEntity } from '@/app/services/loadPluginEditorConfigs';
import { getPluginUI } from '@/app/plugins/uiRegistry';
import type {
  Application,
  ApplicationCreatePayload,
  ApplicationUpdatePayload,
} from '@/app/services/types2';
import type { ValidateResult } from '@/app/services/hooks/scenario/useScenarioObjectDialog';
import type { Issue } from '@/app/services/types2';

export type ApplicationAssets = { iconFile: File | null; imgFile: File | null };

export type ApplicationForm = {
  rule_id_str: string;
  name: string;
  short_desc: string | null;
  story: string | null;
  icon_url: string | null;
  img_url: string | null;
  tags: string[];
  player_comment: string | null;
  data: Record<string, unknown>;
};

type State = {
  form: ApplicationForm;
  assets: ApplicationAssets;
  loading: boolean;
  saving: boolean;
  rulesLoading: boolean;
  issues: Issue[];
  config: any | null;
  error: string | null;
};

type Action =
  | { type: 'SET_FORM';       updater: (p: ApplicationForm) => ApplicationForm }
  | { type: 'SET_ASSETS';     updater: (a: ApplicationAssets) => ApplicationAssets }
  | { type: 'SET_DATA';       data: Record<string, unknown> }
  | { type: 'SET_ISSUES';     issues: Issue[] }
  | { type: 'SET_CONFIG';     config: any }
  | { type: 'LOAD_START' }
  | { type: 'LOAD_OK';        app: Application }
  | { type: 'LOAD_ERR';       error: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_DONE' }
  | { type: 'SAVE_ERR';       error: string }
  | { type: 'RULES_LOADING';  value: boolean };

function emptyForm(ruleIdStr = ''): ApplicationForm {
  return {
    rule_id_str: ruleIdStr,
    name: '',
    short_desc: null,
    story: null,
    icon_url: null,
    img_url: null,
    tags: [],
    player_comment: null,
    data: {},
  };
}

function appToForm(app: Application): ApplicationForm {
  return {
    rule_id_str: app.rule_id_str,
    name: app.name,
    short_desc: app.short_desc ?? null,
    story: app.story ?? null,
    icon_url: app.icon_url ?? null,
    img_url: app.img_url ?? null,
    tags: (app.tags as string[]) ?? [],
    player_comment: app.player_comment ?? null,
    data: (app.data as Record<string, unknown>) ?? {},
  };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SET_FORM':      return { ...s, form: a.updater(s.form) };
    case 'SET_ASSETS':    return { ...s, assets: a.updater(s.assets) };
    case 'SET_DATA':      return { ...s, form: { ...s.form, data: a.data } };
    case 'SET_ISSUES':    return { ...s, issues: a.issues };
    case 'SET_CONFIG':    return { ...s, config: a.config };
    case 'LOAD_START':    return { ...s, loading: true, error: null };
    case 'LOAD_OK':       return { ...s, loading: false, form: appToForm(a.app) };
    case 'LOAD_ERR':      return { ...s, loading: false, error: a.error };
    case 'SAVE_START':    return { ...s, saving: true, error: null };
    case 'SAVE_DONE':     return { ...s, saving: false };
    case 'SAVE_ERR':      return { ...s, saving: false, error: a.error };
    case 'RULES_LOADING': return { ...s, rulesLoading: a.value };
    default: return s;
  }
}

export function useApplicationDialog(opts: {
  open: boolean;
  applicationId: string | null;
  ruleIdStr?: string;
  onSaved?: (id: string) => void;
}) {
  const [state, dispatch] = useReducer(reducer, {
    form:         emptyForm(opts.ruleIdStr),
    assets:       { iconFile: null, imgFile: null },
    loading:      false,
    saving:       false,
    rulesLoading: false,
    issues:       [],
    config:       null,
    error:        null,
  });

  // ── загрузка заявки ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!opts.open) return;
    if (!opts.applicationId) {
      // новая заявка — просто берём ruleIdStr из пропсов
      dispatch({ type: 'LOAD_OK', app: emptyForm(opts.ruleIdStr) as any });
      return;
    }
    dispatch({ type: 'LOAD_START' });
    applicationApiService
      .getById(opts.applicationId)
      .then((app) => dispatch({ type: 'LOAD_OK', app }))
      .catch((e) => dispatch({ type: 'LOAD_ERR', error: e.message }));
  }, [opts.open, opts.applicationId]);

  // ── pluginUI — из локального реестра, без HTTP ────────────────────────────
  const ruleId = state.form.rule_id_str || opts.ruleIdStr || '';
  const pluginUI = useMemo(
    () => (ruleId ? getPluginUI(ruleId) : null),
    [ruleId],
  );

  // ── конфиг редактора — один HTTP-запрос по rule_id_str ────────────────────
  useEffect(() => {
    if (!opts.open || !ruleId || ruleId === 'undefined') return;
    let cancelled = false;

    dispatch({ type: 'RULES_LOADING', value: true });
    loadPluginEditorConfigForEntity({
      scope: { scope: 'rule', id: ruleId },
      entity: 'character',
      needInit: !opts.applicationId,
      fetchSchema: (entity, etag) => applicationApiService.getRuleSchema(ruleId, entity, etag),
      fetchInit: (entity, ctx) => applicationApiService.getRuleInit(ruleId, entity, ctx),
    })
      .then((config) => { if (!cancelled) dispatch({ type: 'SET_CONFIG', config }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) dispatch({ type: 'RULES_LOADING', value: false }); });

    return () => { cancelled = true; };
  }, [opts.open, ruleId]);

  // ── setters ───────────────────────────────────────────────────────────────
  const setForm = useCallback(
    (updater: (p: ApplicationForm) => ApplicationForm) =>
      dispatch({ type: 'SET_FORM', updater }),
    [],
  );
  const setAssets = useCallback(
    (updater: (a: ApplicationAssets) => ApplicationAssets) =>
      dispatch({ type: 'SET_ASSETS', updater }),
    [],
  );
  const setData = useCallback(
    (data: Record<string, unknown>) => dispatch({ type: 'SET_DATA', data }),
    [],
  );

  // ── validate ──────────────────────────────────────────────────────────────
  const validate = useCallback(async (): Promise<ValidateResult> => {
    dispatch({ type: 'RULES_LOADING', value: true });
    try {
      const res = await applicationApiService.validate({
        rule_id_str: state.form.rule_id_str,
        name:        state.form.name,
        data:        state.form.data,
        tags:        state.form.tags,
      });
      const issues = (res?.issues ?? []) as Issue[];
      dispatch({ type: 'SET_ISSUES', issues });
      if (res?.data !== undefined) dispatch({ type: 'SET_DATA', data: res.data });
      return { ok: !!res?.ok, issues, data: res?.data };
    } catch (e: any) {
      return { ok: false, issues: [], data: undefined };
    } finally {
      dispatch({ type: 'RULES_LOADING', value: false });
    }
  }, [state.form]);

  // ── save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async (force = false) => {
    dispatch({ type: 'SAVE_START' });
    try {
      const updatePayload: ApplicationUpdatePayload = {
        name:           state.form.name,
        short_desc:     state.form.short_desc ?? undefined,
        story:          state.form.story ?? undefined,
        tags:           state.form.tags,
        data:           state.form.data,
        player_comment: state.form.player_comment ?? undefined,
        icon_url:       state.form.icon_url ?? undefined,
        img_url:        state.form.img_url ?? undefined,
      };

      let app: Application;
      if (!opts.applicationId) {
        app = await applicationApiService.create({
          rule_id_str:    state.form.rule_id_str,
          name:           state.form.name,
          short_desc:     state.form.short_desc ?? undefined,
          story:          state.form.story ?? undefined,
          tags:           state.form.tags,
          data:           state.form.data,
          player_comment: state.form.player_comment ?? undefined,
        } satisfies ApplicationCreatePayload);
        if (state.assets.iconFile || state.assets.imgFile) {
          app = await applicationApiService.update(
            app.id, updatePayload,
            state.assets.iconFile ?? undefined,
            state.assets.imgFile ?? undefined,
          );
        }
      } else {
        app = await applicationApiService.update(
          opts.applicationId, updatePayload,
          state.assets.iconFile ?? undefined,
          state.assets.imgFile ?? undefined,
        );
      }

      dispatch({ type: 'SAVE_DONE' });
      opts.onSaved?.(app.id);
      return app;
    } catch (e: any) {
      dispatch({ type: 'SAVE_ERR', error: e.message });
    }
  }, [state, opts]);

  // ── dlg — совместимый с CharacterDlg ─────────────────────────────────────
  const dlg = useMemo(() => ({
    form: {
      id: opts.applicationId ?? null,
      ...state.form,
      owned_items: [],
      take_from_other_owner_ids: [],
    },
    assets:  state.assets,
    lookups: { items: [], locations: [] },
    data:         state.form.data,
    config:       state.config,
    issues:       state.issues,
    rulesLoading: state.rulesLoading,
    setForm: (updater: any) =>
      setForm((prev) => {
        const patch = typeof updater === 'function' ? updater(prev) : updater;
        const { owned_items: _o, take_from_other_owner_ids: _t, id: _id, ...fields } = patch ?? {};
        return { ...prev, ...fields };
      }),
    setAssets,
    setData,
  }), [state, opts.applicationId, setForm, setAssets, setData]);

  return { ...state, dlg, pluginUI, setForm, setAssets, setData, validate, save };
}