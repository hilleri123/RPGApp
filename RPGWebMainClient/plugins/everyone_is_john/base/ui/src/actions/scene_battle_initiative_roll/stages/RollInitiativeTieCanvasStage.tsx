'use client';
import React, { useRef, useEffect, useState } from 'react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function RollInitiativeTieCanvasStage({ user_id, action, value, patch, setSubmitEnabled }: any) {
  const wf: any = action?.workflow ?? {};
  const ctx = (wf?.stageData && Object.keys(wf.stageData).length > 0)
    ? wf.stageData
    : (wf?.context ?? {});

  const order: any[] = Array.isArray(ctx?.order) ? ctx.order : [];
  const tieIds = new Set((Array.isArray(ctx?.tieEntityIds) ? ctx.tieEntityIds : []).map((x: any) => asStr(x)));
  const currentIndex: number = typeof ctx?.currentIndex === 'number' ? ctx.currentIndex : 0;
  const cur = order[currentIndex] ?? {};

  const ownerUserId = asStr(cur?.ownerUserId, '');
  const curName = asStr(cur?.name, asStr(cur?.entityId, '—'));
  const isMyTurn = !!user_id && !!ownerUserId && user_id === ownerUserId;

  // список финалистов со статусом
  const finalists = order.filter((e: any) => tieIds.has(asStr(e?.entityId)));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    setSubmitEnabled?.(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#111';
    c.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    c.beginPath(); c.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const c = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    c.lineTo(pos.x, pos.y);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round';
    c.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    setSubmitEnabled?.(true);
    patch({ canvas_seed: canvasRef.current!.toDataURL('image/png') });
  };

  const clear = () => {
    const c = canvasRef.current!.getContext('2d')!;
    c.fillStyle = '#111'; c.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    setHasDrawn(false);
    setSubmitEnabled?.(false);
    patch({ canvas_seed: null });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Тай-брейк: нарисуй seed для d20</div>

      {/* прогресс очереди */}
      <div className="rounded border px-3 py-2 bg-zinc-950/30 space-y-1">
        {finalists.map((e: any) => {
          const done = !!e.canvasSeed;
          const isCur = asStr(e.entityId) === asStr(cur?.entityId);
          return (
            <div key={asStr(e.entityId)} className="flex items-center gap-2 text-xs">
              <span className={done ? 'text-green-400' : isCur ? 'text-yellow-400' : 'text-white/40'}>
                {done ? '✓' : isCur ? '✏️' : '○'}
              </span>
              <span className={isCur ? 'text-white font-semibold' : 'text-white/60'}>
                {asStr(e.name, asStr(e.entityId))}
              </span>
              {done && <span className="text-green-400/60">готово</span>}
            </div>
          );
        })}
      </div>

      {isMyTurn ? (
        <>
          <div className="text-xs text-white/50">
            Твой ход, <span className="text-white">{curName}</span>! Нарисуй что угодно — это станет seed для d20.
          </div>

          <canvas
            ref={canvasRef}
            width={400} height={200}
            className="w-full rounded border border-white/20 cursor-crosshair touch-none"
            style={{ background: '#111' }}
            onMouseDown={startDraw} onMouseMove={draw}
            onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />

          <div className="flex gap-2">
            <button type="button"
              className="border rounded px-3 py-1 text-xs text-white/60"
              onClick={clear}>Очистить</button>
            {hasDrawn && <span className="text-xs text-green-400 self-center">✓ seed готов</span>}
          </div>
        </>
      ) : (
        <div className="text-sm text-white/70">
          Ждём, пока <span className="text-white font-semibold">{curName}</span> нарисует seed…
        </div>
      )}
    </div>
  );
}
