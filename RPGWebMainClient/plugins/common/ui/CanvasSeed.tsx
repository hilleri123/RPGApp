'use client';

import React, { useRef, useEffect, useState } from 'react';

type Props = {
  /** Вызывается когда seed изменился (base64 png или null при очистке) */
  onChange: (seed: string | null) => void;
  /** Описание под заголовком */
  hint?: React.ReactNode;
  disabled?: boolean;
};

export function CanvasSeed({ onChange, hint, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#111';
    c.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const c = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    c.beginPath();
    c.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || disabled) return;
    const c = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    c.lineTo(pos.x, pos.y);
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    onChange(canvasRef.current!.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#111';
    c.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="font-medium text-sm">Нарисуй seed для броска</div>

      {hint && (
        <div className="text-xs text-white/50">{hint}</div>
      )}

      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className={`w-full rounded border border-white/20 touch-none
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-crosshair'}`}
        style={{ background: '#111' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      <div className="flex gap-2 items-center">
        <button
          type="button"
          disabled={disabled}
          className="border rounded px-3 py-1 text-xs text-white/60 disabled:opacity-40"
          onClick={clear}
        >
          Очистить
        </button>
        {hasDrawn && (
          <span className="text-xs text-green-400">✓ seed готов</span>
        )}
      </div>
    </div>
  );
}
