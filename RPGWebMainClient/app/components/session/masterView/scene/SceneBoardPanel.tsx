'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUrlTab } from '@/app/services/hooks/useUrlTab';
import type { SceneWorkspaceTab } from '@/app/services/stores/masterUi';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import type { Location } from '@/app/services/types2';
import type { MapOverlay, Scene, SceneToken } from '@/app/services/types/session';
import { ExposureCard } from '../ExposureCard';
import { AudioPlayerPanel } from '../control/AudioPlayerPanel';
import ExcalidrawDynamic from '@/app/components/scenarios/dialogs/tabs/location/ExcalidrawDynamic';
import { SceneCanvasView } from './SceneCanvasView';

const TABS: readonly SceneWorkspaceTab[] = ['canvas', 'location', 'exposures', 'music'];

function treeLocations(rootId: string, locations: Location[]): Location[] {
  const children = new Map<string, Location[]>();
  for (const loc of locations) {
    const parent = loc.parent_location_id ? String(loc.parent_location_id) : '';
    const list = children.get(parent) ?? [];
    list.push(loc);
    children.set(parent, list);
  }
  const out: Location[] = [];
  const walk = (id: string) => {
    const loc = locations.find((item) => String(item.id) === id);
    if (!loc || out.some((item) => item.id === loc.id)) return;
    out.push(loc);
    for (const child of children.get(id) ?? []) walk(String(child.id));
  };
  walk(rootId);
  return out;
}

function locationHasMap(loc: Location): boolean {
  return Boolean(loc.map_url || loc.excalidraw_map_json?.elements?.length || (loc.map_width && loc.map_height));
}

export function SceneBoardPanel({ sessionId, scene }: { sessionId: string; scene: Scene }) {
  const {
    locations,
    characters,
    npcs,
    items,
    session,
    mapOverlays,
    setSceneLocation,
    createSceneCanvases,
    deleteSceneCanvas,
    setShownCanvas,
    setPlayerCanvas,
    updateSceneCanvas,
    saveMapOverlay,
    deleteMapOverlay,
    mergeMapOverlay,
    setLocationMapGrid,
    applySceneExposure,
  } = useSessionWebSocket(sessionId);
  const [tab, setTab] = useUrlTab<SceneWorkspaceTab>(TABS, 'canvas', { paramName: 'sceneTab' });
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [maskId, setMaskId] = useState<string | null>(null);
  const overlaySave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const tree = useMemo(
    () => treeLocations(String(scene.location?.id ?? ''), locations ?? []),
    [scene.location?.id, locations],
  );
  const canvases = scene.canvases ?? [];
  const active = canvases.find((item) => item.id === (canvasId ?? scene.shown_canvas_id)) ?? canvases[0] ?? null;
  const activeLocation = (locations ?? []).find((loc) => String(loc.id) === String(active?.location_id)) ?? null;
  const overlays = (mapOverlays ?? []).filter((item) => !active || item.location_id === active.location_id);
  const editing = overlays.find((item) => item.id === maskId) ?? null;

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entity of [...(characters ?? []), ...(npcs ?? []), ...(items ?? [])]) {
      if (entity?.id) map[String(entity.id)] = entity.name ?? '';
    }
    return map;
  }, [characters, npcs, items]);

  const catalog = useMemo(() => {
    const bucket = (scene.containers ?? []).find((item) => String(item.location_id) === String(active?.location_id));
    const ids = new Set<string>([
      ...(bucket?.character_ids ?? []),
      ...(bucket?.public?.npc_ids ?? []),
      ...(bucket?.private?.npc_ids ?? []),
      ...(bucket?.public?.item_ids ?? []),
      ...(bucket?.private?.item_ids ?? []),
      ...(bucket?.public?.obstacle_ids ?? []),
      ...(bucket?.private?.obstacle_ids ?? []),
    ].map(String));
    const rows: { entity_type: SceneToken['entity_type']; entity_id: string; name: string }[] = [];
    for (const id of ids) {
      const character = (characters ?? []).find((item) => String(item.id) === id);
      if (character) rows.push({ entity_type: 'character', entity_id: id, name: character.name });
      const npc = (npcs ?? []).find((item) => String(item.id) === id);
      if (npc) rows.push({ entity_type: 'npc', entity_id: id, name: npc.name });
      const item = (items ?? []).find((entry) => String(entry.id) === id);
      if (item) rows.push({ entity_type: 'item', entity_id: id, name: item.name });
    }
    if (!rows.length) {
      for (const character of scene.characters ?? []) {
        rows.push({ entity_type: 'character', entity_id: String(character.id), name: character.name });
      }
    }
    return rows;
  }, [scene, active?.location_id, characters, npcs, items]);

  const moveToken = (index: number, next: { col: number; row: number; x: number; y: number }) => {
    if (!active) return;
    const tokens = (active.tokens ?? []).map((token, tokenIndex) => (
      tokenIndex === index ? { ...token, ...next } : token
    ));
    updateSceneCanvas(scene.id, active.id, { tokens });
  };

  const addToken = (entity_type: SceneToken['entity_type'], entity_id: string) => {
    if (!active) return;
    if ((active.tokens ?? []).some((token) => token.entity_id === entity_id)) return;
    updateSceneCanvas(scene.id, active.id, {
      tokens: [...(active.tokens ?? []), {
        entity_type, entity_id, col: 0, row: 0, span_w: 1, span_h: 1, x: 0.1, y: 0.1,
      }],
    });
  };

  const exposures = tree.flatMap((loc) =>
    (loc.scene_exposures ?? [])
      .filter((ex) => !nameFilter || (ex.name ?? '').toLowerCase().includes(nameFilter.toLowerCase()))
      .filter(() => !locationFilter || String(loc.id) === locationFilter)
      .map((ex) => ({ ex, loc })),
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-800 flex gap-2 flex-wrap">
        {([
          ['canvas', 'Холст'],
          ['location', 'Локация'],
          ['exposures', 'Экспозиции'],
          ['music', 'Музыка'],
        ] as const).map(([id, label]) => (
          <Button key={id} size="sm" variant={tab === id ? 'secondary' : 'outline'} onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === 'canvas' && (
        <div className="flex-1 min-h-0 flex">
          <div className="w-64 shrink-0 border-r border-gray-800 p-2 overflow-auto space-y-2 text-xs text-gray-200">
            {canvases.map((canvas) => (
              <button
                key={canvas.id}
                className={`w-full text-left rounded px-2 py-1 ${canvas.id === active?.id ? 'bg-gray-800' : ''}`}
                onClick={() => setCanvasId(canvas.id)}
              >
                {canvas.name || 'Холст'}
                {canvas.id === scene.shown_canvas_id ? ' · стол' : ''}
              </button>
            ))}
            {!canvases.length && <div className="text-gray-500">Холстов нет. Создай их на вкладке «Локация».</div>}
            {active && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShownCanvas(scene.id, active.id)}>Показать столу</Button>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active.grid_on}
                    onChange={(event) => updateSceneCanvas(scene.id, active.id, { grid_on: event.target.checked })}
                  />
                  Сетка
                </label>
                <div className="text-gray-400">Кому показывать</div>
                {(session?.players ?? []).filter((player) => player.user?.id).map((player) => (
                  <label key={player.user.id} className="block">
                    <span className="text-gray-400">{player.user.full_name || 'игрок'}</span>
                    <select
                      className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-1 py-1"
                      value={scene.player_canvas?.[player.user.id] ?? ''}
                      onChange={(event) => setPlayerCanvas(scene.id, player.user.id, event.target.value || null)}
                    >
                      <option value="">Как у стола</option>
                      {canvases.map((canvas) => (
                        <option key={canvas.id} value={canvas.id}>{canvas.name || 'Холст'}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <div className="text-gray-400">Токены</div>
                {catalog.map((row) => (
                  <button key={row.entity_id} className="block w-full text-left hover:text-white" onClick={() => addToken(row.entity_type, row.entity_id)}>
                    + {row.name}
                  </button>
                ))}
                {(active.tokens ?? []).map((token, index) => (
                  <div key={`${token.entity_id}-${index}`} className="flex items-center gap-1">
                    <span className="flex-1 truncate">{names[token.entity_id] ?? token.entity_type}</span>
                    <select
                      className="bg-gray-900 border border-gray-700 rounded"
                      value={`${token.span_w}x${token.span_h}`}
                      onChange={(event) => {
                        const [spanW, spanH] = event.target.value.split('x').map(Number);
                        const tokens = (active.tokens ?? []).map((item, itemIndex) => (
                          itemIndex === index ? { ...item, span_w: spanW, span_h: spanH } : item
                        ));
                        updateSceneCanvas(scene.id, active.id, { tokens });
                      }}
                    >
                      <option>1x1</option>
                      <option>2x2</option>
                      <option>2x1</option>
                      <option>1x2</option>
                      <option>3x3</option>
                    </select>
                  </div>
                ))}
                <div className="text-gray-400">Маски</div>
                {overlays.map((overlay) => (
                  <label key={overlay.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(active.mask_ids ?? []).includes(overlay.id)}
                      onChange={(event) => {
                        const mask_ids = event.target.checked
                          ? [...(active.mask_ids ?? []), overlay.id]
                          : (active.mask_ids ?? []).filter((id) => id !== overlay.id);
                        updateSceneCanvas(scene.id, active.id, { mask_ids });
                      }}
                    />
                    <button type="button" className="truncate text-left" onClick={() => setMaskId(overlay.id)}>{overlay.name || 'Рисунок'}</button>
                  </label>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const overlay: MapOverlay = {
                      id: crypto.randomUUID(),
                      location_id: active.location_id,
                      name: 'Рисунок',
                      scene: { elements: [], appState: {}, files: {} },
                    };
                    saveMapOverlay(overlay);
                    setMaskId(overlay.id);
                  }}
                >
                  Новый рисунок
                </Button>
              </>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {active && activeLocation ? (
              <SceneCanvasView
                location={activeLocation}
                canvas={active}
                overlays={mapOverlays ?? []}
                names={names}
                editable
                onTokenMove={moveToken}
              />
            ) : (
              <div className="p-3 text-xs text-gray-500">Выбери холст.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'location' && (
        <div className="p-3 space-y-3 text-sm text-gray-200 overflow-auto">
          <div>Корень: {scene.location?.name ?? '—'}</div>
          <div className="flex flex-wrap gap-2">
            {tree.map((loc) => (
              <Button
                key={String(loc.id)}
                size="sm"
                variant={String(loc.id) === String(scene.location?.id) ? 'secondary' : 'outline'}
                onClick={() => setSceneLocation(scene.id, String(loc.id))}
              >
                {loc.name}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => createSceneCanvases(scene.id, undefined, true)}>Холст на каждую карту</Button>
            {tree.filter(locationHasMap).map((loc) => (
              <Button key={`c-${loc.id}`} size="sm" variant="outline" onClick={() => createSceneCanvases(scene.id, String(loc.id), false)}>
                Холст: {loc.name}
              </Button>
            ))}
          </div>
          {canvases.map((canvas) => (
            <div key={canvas.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1">{canvas.name} · локация зафиксирована</span>
              <Button size="sm" variant="destructive" onClick={() => deleteSceneCanvas(scene.id, canvas.id)}>Удалить</Button>
            </div>
          ))}
          {activeLocation && (
            <GridForm
              location={activeLocation}
              onSave={(grid) => setLocationMapGrid(String(activeLocation.id), grid)}
            />
          )}
        </div>
      )}

      {tab === 'exposures' && (
        <div className="p-3 space-y-2 overflow-auto">
          <div className="flex gap-2">
            <Input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Имя" className="h-8" />
            <select className="bg-gray-900 border border-gray-700 rounded px-2 text-xs" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="">Все локации</option>
              {tree.map((loc) => <option key={String(loc.id)} value={String(loc.id)}>{loc.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {exposures.map(({ ex, loc }) => (
              <ExposureCard
                key={`${loc.id}:${ex.id}`}
                ex={ex}
                scene_id={scene.id}
                location_id={String(loc.id)}
                sourceLabel={loc.name}
                applySceneExposure={applySceneExposure}
              />
            ))}
            {!exposures.length && <div className="text-xs text-gray-500">Экспозиций нет.</div>}
          </div>
        </div>
      )}

      {tab === 'music' && (
        <div className="flex-1 min-h-0 p-3">
          <AudioPlayerPanel sessionId={sessionId} />
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="flex items-center gap-2 p-2 bg-gray-950">
            <Input
              value={editing.name}
              onChange={(event) => saveMapOverlay({ ...editing, name: event.target.value })}
              className="h-8 max-w-xs"
            />
            <Button size="sm" onClick={() => mergeMapOverlay(editing.id)}>Влить в карту</Button>
            <Button size="sm" variant="destructive" onClick={() => { deleteMapOverlay(editing.id); setMaskId(null); }}>Удалить</Button>
            <Button size="sm" variant="outline" onClick={() => setMaskId(null)}>Закрыть</Button>
          </div>
          <div className="flex-1 min-h-0">
            <ExcalidrawDynamic
              initialData={{
                elements: editing.scene?.elements ?? [],
                appState: { ...(editing.scene?.appState ?? {}), collaborators: new Map() },
                files: editing.scene?.files ?? {},
              }}
              onChange={(elements: any, appState: any, files: any) => {
                if (overlaySave.current) clearTimeout(overlaySave.current);
                overlaySave.current = setTimeout(() => {
                  saveMapOverlay({
                    ...editing,
                    scene: { elements, appState: { ...appState, collaborators: undefined }, files },
                  });
                }, 400);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GridForm({
  location,
  onSave,
}: {
  location: Location;
  onSave: (grid: NonNullable<Location['map_grid']>) => void;
}) {
  const current = location.map_grid ?? {
    cols: 10,
    rows: 10,
    origin_x: 0,
    origin_y: 0,
    cell_w: Math.round((location.map_width || 1000) / 10),
    cell_h: Math.round((location.map_height || 1000) / 10),
  };
  const [grid, setGrid] = useState(current);
  const field = (key: keyof typeof grid, label: string) => (
    <label className="text-xs text-gray-300">
      {label}
      <Input
        className="h-8 mt-1"
        type="number"
        value={grid[key]}
        onChange={(event) => setGrid({ ...grid, [key]: Number(event.target.value) })}
      />
    </label>
  );
  return (
    <div className="grid grid-cols-3 gap-2 max-w-lg">
      {field('cols', 'Колонки')}
      {field('rows', 'Ряды')}
      {field('origin_x', 'Сдвиг X')}
      {field('origin_y', 'Сдвиг Y')}
      {field('cell_w', 'Клетка X')}
      {field('cell_h', 'Клетка Y')}
      <Button size="sm" className="col-span-3" onClick={() => onSave(grid)}>Сохранить сетку локации</Button>
    </div>
  );
}
