'use client';

import React from 'react';
import { SquareTile } from '@/app/components/common/SquareTile';
import { TYPE_COLORS, TYPE_ICONS, getNpcStyle } from '@/lib/constants';

export type EntitySquareKind = 'character' | 'npc';

export interface EntitySquareProps {
  name: string;
  kind: EntitySquareKind;
  /** icon_url ?? img_url сущности; без него рисуется иконка по типу. */
  iconUrl?: string | null;
  /** Свой цвет сущности (цвет игрока персонажа): заливка; цвет типа уходит в рамку-орнамент. */
  color?: string | null;
  isEnemy?: boolean;
  isDead?: boolean;
  overlay?: React.ReactNode;
  showName?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Квадрат сущности сцены для плагинов: те же цвета/иконки/размеры, что у
 * CharacterDraggableSquare / NPCDraggableSquare, но без drag&drop и меню.
 */
export function EntitySquare({
  name,
  kind,
  iconUrl,
  color: ownColor,
  isEnemy = false,
  isDead = false,
  overlay,
  showName = true,
  className,
  style,
}: EntitySquareProps) {
  const { color, Icon } =
    kind === 'character'
      ? { color: TYPE_COLORS.character, Icon: TYPE_ICONS.character }
      : (() => {
          const st = getNpcStyle(isDead, isEnemy);
          return { color: st.color, Icon: st.icon };
        })();

  const icon = iconUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl}
      alt={name}
      className="w-8 h-8 object-contain rounded"
    />
  ) : (
    <Icon className="w-6 h-6" />
  );

  return (
    <SquareTile
      name={name}
      color={ownColor || color}
      ornament={ownColor ? color : undefined}
      icon={icon}
      overlay={overlay}
      showName={showName}
      className={className}
      style={style}
    />
  );
}
