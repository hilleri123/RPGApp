'use client';
import React, { useRef, useEffect, useState } from 'react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function ActionCanvasStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf: any = action?.workflow ?? {};
  const ctx = (wf?.stageData && Object.keys(wf.stageData).length > 0)
  ? wf.stageData
  : (wf?.context ?? {});
  const entry = ctx?.entry ?? {};

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // инициализация canvas
  useEffect(() => {
    setSubmitEnabled(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#111';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const ctx2d = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx2d.beginPath();
    ctx2d.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current!;
    const ctx2d = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx2d.lineTo(pos.x, pos.y);
    ctx2d.strokeStyle = '#fff';
    ctx2d.lineWidth = 3;
    ctx2d.lineCap = 'round';
    ctx2d.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    setDrawing(false);
    setSubmitEnabled(true);
    // превращаем canvas в base64 seed
    const canvas = canvasRef.current!;
    patch({ canvas_seed: canvas.toDataURL('image/png') });
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#111';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    patch({ canvas_seed: null });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Нарисуй seed для броска</div>
      <div className="text-xs text-white/50">
        Нарисуй что угодно — рисунок станет основой для броска {3 + (entry.has_profession?4:0) + 2*(entry.spend_tokens??0)}d6
      </div>

      <canvas
        ref={canvasRef}
        width={400} height={200}
        className="w-full rounded border border-white/20 cursor-crosshair touch-none"
        style={{ background: '#111' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      <div className="flex gap-2">
        <button
          type="button"
          className="border rounded px-3 py-1 text-xs text-white/60"
          onClick={clear}
        >Очистить</button>
        {hasDrawn && (
          <span className="text-xs text-green-400 self-center">✓ seed готов</span>
        )}
      </div>
    </div>
  );
}
