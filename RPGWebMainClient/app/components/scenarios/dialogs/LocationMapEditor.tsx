'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DialogFooter } from '@/components/ui/dialog';
import { useLocationDialog } from '@/app/services/hooks/scenario/dialogs/useLocationDialog';
import { DialogModeProvider } from './common/DialogModeContext';
import RasterMapTab from './tabs/location/RasterMapTab';
import ExcalidrawMapTab from './tabs/location/ExcalidrawMapTab';
import SublocationsTab from './tabs/location/SublocationsTab';
import { notifyLocationMapSaved } from './locationMapSaved';
import {
  captureMapBaseline,
  clearMapBaseline,
  cloneBaselineForm,
  fetchMapFile,
  readMapBaselines,
  writeCommittedBaseline,
  writeMapBaseline,
  type MapBaseline,
} from './locationMapBaseline';

function formSignature(form: any, mapFile: File | null) {
  return JSON.stringify({
    name: form?.name ?? '',
    map_url: form?.map_url ?? null,
    map_width: form?.map_width ?? null,
    map_height: form?.map_height ?? null,
    excalidraw_map_json: form?.excalidraw_map_json ?? null,
    map_objects: form?.map_objects ?? [],
    sublocations: form?.sublocations ?? [],
    file: mapFile ? `${mapFile.name}:${mapFile.size}:${mapFile.lastModified}` : '',
  });
}

export function LocationMapEditor({
  scenarioId,
  locationId,
  onSaved,
  onClose,
  onBindDismiss,
  fill = false,
  live = false,
  initialTab = 'map-raster',
}: {
  scenarioId: string;
  locationId: string;
  onSaved?: (id: string, name: string) => void;
  onClose?: () => void;
  onBindDismiss?: (dismiss: () => void) => void;
  fill?: boolean;
  live?: boolean;
  initialTab?: 'map-raster' | 'map-excalidraw' | 'sublocations';
}) {
  const nameRef = useRef('');
  const [savedHint, setSavedHint] = useState(false);
  const [kept, setKept] = useState(false);
  const [baseline, setBaseline] = useState<MapBaseline | null>(null);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'live' | 'error'>('idle');
  const [restoreTick, setRestoreTick] = useState(0);
  const baselineRef = useRef<MapBaseline | null>(null);
  const committedRef = useRef<MapBaseline | null>(null);
  const keptSignature = useRef<string | null>(null);
  const saveRef = useRef<(force?: boolean) => Promise<any>>(async () => null);
  const setFormRef = useRef<(value: any) => void>(() => {});
  const setAssetsRef = useRef<(value: any) => void>(() => {});
  const skipAutosave = useRef(false);
  const lastSignature = useRef('');
  const sawBaseline = useRef(false);
  const restoreWait = useRef<(() => void) | null>(null);

  const dlg = useLocationDialog({
    open: true,
    scenarioId,
    locationId,
    onSaved: (id) => {
      const name = nameRef.current;
      setSavedHint(true);
      notifyLocationMapSaved({ scenarioId, locationId: id, name });
      onSaved?.(id, name);
    },
  });
  nameRef.current = dlg.form?.name ?? '';
  saveRef.current = dlg.save;
  setFormRef.current = dlg.setForm;
  setAssetsRef.current = dlg.setAssets;
  baselineRef.current = baseline;
  const formRef = useRef(dlg.form);
  const assetsRef = useRef(dlg.assets);
  formRef.current = dlg.form;
  assetsRef.current = dlg.assets;

  const waiting = !dlg.full && !dlg.error;
  const preparing = live && !waiting && !baseline;

  useEffect(() => {
    if (!live || waiting || !dlg.full || baseline) return;
    let cancelled = false;
    const stored = readMapBaselines(scenarioId, locationId);
    if (stored) {
      committedRef.current = stored.committed;
      setBaseline(stored.original);
      return;
    }
    const form = formRef.current;
    void (async () => {
      const captured = await captureMapBaseline(form);
      if (cancelled) return;
      await writeMapBaseline(scenarioId, locationId, captured);
      if (cancelled) return;
      committedRef.current = captured;
      setBaseline(captured);
    })();
    return () => {
      cancelled = true;
    };
  }, [baseline, dlg.full, live, locationId, scenarioId, waiting]);

  const tailRef = useRef<Promise<{ ok: boolean; nextUrl: string | null }>>(
    Promise.resolve({ ok: false, nextUrl: null }),
  );
  const saveGeneration = useRef(0);

  const persist = useCallback(() => {
    const generation = saveGeneration.current + 1;
    saveGeneration.current = generation;
    const run = tailRef.current.then(async () => {
      if (generation !== saveGeneration.current) return { ok: false, nextUrl: null };
      setPhase('saving');
      const sentSignature = formSignature(formRef.current, assetsRef.current?.mapFile ?? null);
      try {
        const result = await saveRef.current(true);
        if (generation !== saveGeneration.current) return { ok: false, nextUrl: null };
        const nextUrl = (result?.location?.map_url as string | null | undefined) ?? null;
        if (result?.location) {
          const urlChanged = Boolean(nextUrl) && formRef.current?.map_url !== nextUrl;
          const hadFile = Boolean(assetsRef.current?.mapFile);
          if (urlChanged || hadFile) skipAutosave.current = true;
          if (urlChanged) {
            setFormRef.current((prev: any) => ({ ...prev, map_url: nextUrl }));
          }
          if (hadFile) {
            setAssetsRef.current((prev: any) => ({ ...prev, mapFile: null }));
          }
          lastSignature.current = sentSignature;
          setPhase('live');
          setSavedHint(true);
          return { ok: true, nextUrl };
        }
        setPhase('error');
        return { ok: false, nextUrl: null };
      } catch {
        setPhase('error');
        return { ok: false, nextUrl: null };
      }
    });
    tailRef.current = run.catch(() => ({ ok: false, nextUrl: null }));
    return run;
  }, []);

  const signature = formSignature(dlg.form, dlg.assets?.mapFile ?? null);

  useEffect(() => {
    if (!live || !baseline) return;
    if (!sawBaseline.current) {
      sawBaseline.current = true;
      lastSignature.current = signature;
      return;
    }
    if (skipAutosave.current) {
      skipAutosave.current = false;
      lastSignature.current = signature;
      return;
    }
    if (kept && keptSignature.current && signature !== keptSignature.current) {
      setKept(false);
    }
    if (signature === lastSignature.current) return;
    const timer = window.setTimeout(() => {
      void persist();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [baseline, kept, live, persist, signature]);

  const applySnapshot = useCallback((snap: MapBaseline | null) => {
    if (!snap) return Promise.resolve();
    return new Promise<void>((resolve) => {
      restoreWait.current = resolve;
      skipAutosave.current = true;
      setFormRef.current(cloneBaselineForm(snap));
      setAssetsRef.current((prev: any) => ({ ...prev, mapFile: snap.mapFile }));
      setRestoreTick((tick) => tick + 1);
    });
  }, []);

  const applyBaseline = useCallback(
    () => applySnapshot(baselineRef.current),
    [applySnapshot],
  );

  useEffect(() => {
    if (!restoreTick) return;
    void (async () => {
      await persist();
      restoreWait.current?.();
      restoreWait.current = null;
    })();
  }, [persist, restoreTick]);

  const saveCommitted = useCallback(async () => {
    const fileAtStart = assetsRef.current?.mapFile ?? null;
    const saved = await persist();
    const form = cloneBaselineForm({ form: formRef.current, mapFile: null });
    if (saved?.nextUrl) form.map_url = saved.nextUrl;
    const mapFile = fileAtStart
      ?? (form?.map_url ? await fetchMapFile(String(form.map_url)) : null);
    const snap = { form, mapFile };
    committedRef.current = snap;
    keptSignature.current = formSignature(form, null);
    await writeCommittedBaseline(scenarioId, locationId, snap);
    setKept(true);
    setSavedHint(true);
    setPhase('live');
  }, [locationId, persist, scenarioId]);

  const cancel = useCallback(async () => {
    await applySnapshot(committedRef.current ?? baselineRef.current);
    clearMapBaseline(scenarioId, locationId);
    onClose?.();
  }, [applySnapshot, locationId, onClose, scenarioId]);

  useEffect(() => {
    if (!live) return;
    onBindDismiss?.(() => { void cancel(); });
  }, [cancel, live, onBindDismiss]);

  const nameMissing = !String(dlg.form?.name ?? '').trim();
  const issues = dlg.issues ?? [];

  return (
    <DialogModeProvider readOnly={false}>
      {waiting || preparing ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          {preparing ? <span>Запоминаю карту…</span> : null}
        </div>
      ) : (
        <>
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">Имя</div>
            <Input
              placeholder="Имя"
              value={dlg.form?.name ?? ''}
              onChange={(e) => {
                setSavedHint(false);
                dlg.setForm((prev: any) => ({ ...prev, name: e.target.value }));
              }}
            />
          </div>

          <Tabs defaultValue={initialTab} className="flex-1 overflow-hidden">
            <TabsList className="mb-2">
              <TabsTrigger value="map-raster">Фон (растр)</TabsTrigger>
              <TabsTrigger value="map-excalidraw">Вектор (Excalidraw)</TabsTrigger>
              <TabsTrigger value="sublocations">Подлокации</TabsTrigger>
            </TabsList>

            <div className={fill ? 'overflow-y-auto pr-1 max-h-[calc(100vh-16rem)]' : 'overflow-y-auto pr-1 max-h-[70vh]'}>
              <TabsContent value="map-raster" className="space-y-3">
                <RasterMapTab key={restoreTick} dlg={dlg} editingId={locationId} />
              </TabsContent>
              <TabsContent value="map-excalidraw" className="space-y-3">
                <ExcalidrawMapTab key={restoreTick} dlg={dlg} editingId={locationId} />
              </TabsContent>
              <TabsContent value="sublocations" className="space-y-3">
                <SublocationsTab key={restoreTick} dlg={dlg} editingId={locationId} />
              </TabsContent>
            </div>
          </Tabs>

          {dlg.error ? <div className="mt-2 text-sm text-red-400">{dlg.error}</div> : null}
          {issues.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-amber-300">
              {issues.map((issue: { path?: string; message?: string }, index: number) => (
                <li key={`${issue.path ?? 'issue'}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          {live && phase === 'saving' ? (
            <div className="mt-2 text-sm text-gray-400">Сохраняю… игроки увидят карту сразу после записи</div>
          ) : null}
          {live && kept ? (
            <div className="mt-2 text-sm text-green-400">Сохранено. Закрытие больше не откатит карту</div>
          ) : null}
          {live && phase === 'live' && savedHint && !kept ? (
            <div className="mt-2 text-sm text-gray-400">Игроки видят черновик. Нажмите «Сохранить», чтобы он остался</div>
          ) : null}
          {live && phase === 'error' ? (
            <div className="mt-2 text-sm text-red-400">Не удалось отправить карту игрокам</div>
          ) : null}
          {!live && savedHint && issues.length === 0 ? (
            <div className="mt-2 text-sm text-green-400">Сохранено</div>
          ) : null}

          <DialogFooter className="gap-2 mt-4">
            {live ? (
              <>
                <Button
                  type="button"
                  onClick={() => void saveCommitted()}
                  disabled={phase === 'saving' || nameMissing || !baseline}
                >
                  {phase === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => void applyBaseline()} disabled={!baseline || phase === 'saving'}>
                  Сбросить
                </Button>
                <Button type="button" variant="secondary" onClick={() => void cancel()} disabled={phase === 'saving'}>
                  Отмена
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => void dlg.save(false)}
                  disabled={dlg.loading || dlg.rulesLoading || nameMissing}
                >
                  {dlg.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                </Button>
                {issues.length > 0 ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void dlg.save(true)}
                    disabled={dlg.loading || dlg.rulesLoading || nameMissing}
                  >
                    Сохранить принудительно
                  </Button>
                ) : null}
              </>
            )}
          </DialogFooter>
        </>
      )}
    </DialogModeProvider>
  );
}
