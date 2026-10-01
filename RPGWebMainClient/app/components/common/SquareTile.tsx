'use client';

import React from 'react';

export interface SquareTileProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  name: string;
  color: string;
  icon: React.ReactNode;
  overlay?: React.ReactNode;
  /** Цвет «орнамента» — рамка вокруг квадрата. Заливка (`color`) при этом остаётся цветом
   * самой сущности и не пропадает под кастомной иконкой. */
  ornament?: string;
  /** Подпись внутри квадрата (как в списках сцены). Выключите, если подпись рисуется снаружи. */
  showName?: boolean;
}

/**
 * Базовый «квадрат сущности» — единый вид для списков сцены и плагинов.
 * Чисто презентационный: без drag&drop и меню (их добавляет DraggableSquare).
 */
export const SquareTile = React.forwardRef<HTMLDivElement, SquareTileProps>(function SquareTile(
  { name, color, icon, overlay, ornament, showName = true, className = '', style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={`relative rounded-lg flex flex-col items-center justify-center select-none ${className}`}
      style={{
        backgroundColor: color,
        width: '3rem',
        height: '3rem',
        ...(ornament ? { border: `3px solid ${ornament}` } : null),
        ...style,
      }}
    >
      <div className="text-white text-xl">{icon}</div>
      {showName ? (
        <div className="font-semibold text-white text-xs mt-1 text-center leading-tight">
          {name.length > 8 ? name.slice(0, 6) + '..' : name}
        </div>
      ) : null}
      {overlay ? (
        <div className="pointer-events-none absolute top-1 -right-2 bottom-1 flex flex-col justify-end gap-1">
          {overlay}
        </div>
      ) : null}
    </div>
  );
});
