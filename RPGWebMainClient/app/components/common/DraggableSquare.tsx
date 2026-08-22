'use client'

import React, { useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Info, Settings, Palette, Trash2, CheckCircle, Share2, ShoppingBag, LogOut, Pencil, Plus, EyeOff, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface ContextItem {
  label: string
  icon?: React.ReactNode
  color?: string
  onClick?: () => void
}

export const ContextActions = {
  edit: {
    label: 'Редактировать',
    icon: <Pencil className="w-4 h-4 text-gray-200" />,
    color: 'orange',
  } satisfies ContextItem,

  addToScene: {
    label: 'Добавить в сцену',
    icon: <Plus className="w-4 h-4 text-blue-400" />,
    color: 'white',
  } satisfies ContextItem,

  makePublic: {
    label: 'Сделать публичным',
    icon: <Eye className="w-4 h-4 text-green-400" />,
    color: 'white',
  } satisfies ContextItem,

  makePrivate: {
    label: 'Сделать приватным',
    icon: <EyeOff className="w-4 h-4 text-orange-400" />,
    color: 'white',
  } satisfies ContextItem,

  removeFromScene: {
    label: 'Удалить из сцены',
    icon: <LogOut className="w-4 h-4 text-orange-500" />,
    color: 'orange',
  } satisfies ContextItem,

  delete: {
    label: 'Удалить',
    icon: <Trash2 className="w-4 h-4 text-red-500" />,
    color: 'red',
  } satisfies ContextItem,

  execute: {
    label: 'Выполнить',
    icon: <CheckCircle className="w-4 h-4 text-green-500" />,
    color: 'green',
  } satisfies ContextItem,

  transfer: {
    label: 'Передать',
    icon: <Share2 className="w-4 h-4 text-blue-500" />,
    color: 'blue',
  } satisfies ContextItem,

  takeItem: {
    label: 'Забрать предмет',
    icon: <ShoppingBag className="w-4 h-4 text-blue-500" />,
    color: 'blue',
  } satisfies ContextItem,

  dropItem: {
    label: 'Выбросить предмет',
    icon: <LogOut className="w-4 h-4 text-orange-500" />,
    color: 'orange',
  } satisfies ContextItem,

  view: {
    label: 'Просмотр',
    icon: <Eye className="w-4 h-4 text-blue-400" />,
    color: 'white',
  } satisfies ContextItem,

  presentToScene: {
    label: 'Показать всем в сцене',
    icon: <Share2 className="w-4 h-4 text-violet-400" />,
    color: 'white',
  } satisfies ContextItem,

  openData: {
    label: 'Открыть данные',
    icon: <Eye className="w-4 h-4 text-emerald-400" />,
    color: 'white',
  } satisfies ContextItem,

  closeData: {
    label: 'Закрыть данные',
    icon: <EyeOff className="w-4 h-4 text-orange-400" />,
    color: 'white',
  } satisfies ContextItem,
} as const;

export function DataRevealedBadge({ isFullSize }: { isFullSize?: boolean }) {
  const box = isFullSize ? 'w-5 h-5' : 'w-4 h-4';
  const icon = isFullSize ? 'w-3 h-3' : 'w-2.5 h-2.5';
  return (
    <div
      className={`${box} rounded-full bg-black/70 border border-emerald-500/60 flex items-center justify-center shadow`}
      title="Данные открыты игрокам"
    >
      <Eye className={`${icon} text-emerald-400`} />
    </div>
  );
}

// Backward-compat exports (если у тебя уже где-то используется)
export const DeleteItemContexMenu = ContextActions.delete;
export const ExecuteItemContextMenu = ContextActions.execute;
export const TransferItemContextMenu = ContextActions.transfer;
export const TakeItemContextMenu = ContextActions.takeItem;
export const DropItemContextMenu = ContextActions.dropItem;



interface DraggableSquareProps {
  name: string
  color: string
  icon: React.ReactNode
  description: React.ReactNode
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void
  contextItems?: ContextItem[]
  onInfo?: () => void
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  className?: string
  isFullSize?: boolean
  draggable?: boolean
  overlay?: React.ReactNode;
}

export function DraggableSquare({
  name,
  color,
  icon,
  description,
  onContextMenu,
  contextItems,
  onInfo,
  onDragStart,
  overlay,
  className = '',
  isFullSize = false,
  draggable = true,
}: DraggableSquareProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const useEntityView = !!onInfo

  const getContainerProps = () => {
    if (draggable) {
      return {
        draggable: true,
        onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
          onDragStart?.(e);
        },
      };
    } else {
      return {
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          if (onContextMenu) {
            onContextMenu(e);
          } else {
            e.preventDefault();
            const evt = new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: e.clientX,
              clientY: e.clientY,
            });
            e.currentTarget.dispatchEvent(evt);
          }
        }
      };
    }
  };

  const commonContainerProps = getContainerProps();

  const fullSizeEl = (
    <div
      {...commonContainerProps}
      onContextMenu={onContextMenu}
      className={`
        flex items-center gap-4 rounded-lg shadow 
        px-5 py-4 min-h-[64px] bg-gray-800 
        border cursor-grab relative select-none transition
        ${className}
        `}
      style={{ borderColor: color }}
    >
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <div className="text-white text-xl">{icon}</div>
      </div>
      <div className="flex flex-col flex-1 min-w-0 py-1">
        {/* <div className="font-semibold text-base truncate" style={{ color }}>
          {name}
        </div> */}
        <div className="text-xs text-gray-500 mt-1">{description}</div>
      </div>
      {overlay ? (
        <div className="pointer-events-none absolute top-1 right-1 bottom-1 flex flex-col justify-end gap-1">
          {overlay}
        </div>
      ) : null}
    </div>
  )

  const smallSizeEl = (
    <div
      {...commonContainerProps}
      className={`relative rounded-lg flex flex-col items-center justify-center cursor-grab select-none ${className}`}
      style={{
        backgroundColor: color,
        width: '3rem',
        height: '3rem',
        padding: undefined,
      }}
      title=""
    >
      <div className="text-white text-xl">{icon}</div>
      <div className="font-semibold text-white text-xs mt-1 text-center leading-tight">
        {name.length > 8 ? name.slice(0, 6) + '..' : name}
      </div>
      {overlay ? (
        <div className="pointer-events-none absolute top-1 -right-2 bottom-1 flex flex-col justify-end gap-1">
          {overlay}
        </div>
      ) : null}
    </div>
  )

  // элемент квадрат
  const squareEl = isFullSize ? (
    fullSizeEl
  ) : (
    smallSizeEl 
  );
  //   <Tooltip.Root>
  //     <Tooltip.Trigger asChild>{smallSizeEl}</Tooltip.Trigger>
  //     {!isDragging && <Tooltip.Content side="top">{description}</Tooltip.Content>}
  //   </Tooltip.Root>
  // );

  // если передан свой обработчик контекстного меню — не навешиваем дефолтное
  if (onContextMenu)
    return squareEl;

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          { squareEl }
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content
            className="min-w-[200px] rounded bg-gray-800 p-1 shadow-xl border border-gray-700 text-white z-50"
          >
            <ContextMenu.Item
              className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer"
              onSelect={() => {
                if (onInfo) onInfo();
                else setInfoOpen(true);
              }}
            >
              {useEntityView ? (
                <>
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>Просмотр</span>
                </>
              ) : (
                <>
                  <Info className="w-4 h-4 text-blue-400" />
                  <span>Info</span>
                </>
              )}
            </ContextMenu.Item>

            <ContextMenu.Separator className="h-px bg-gray-700 m-1" />

            {contextItems && (
              contextItems.map((item) => (
                <ContextMenu.Item
                  key={item.label}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer"
                  onSelect={item.onClick}
                  style={{ color: item.color ?? 'white' }}
                >
                  {item.icon ?? <Settings className="w-4 h-4 text-gray-400" />}
                  <span>{item.label}</span>
                </ContextMenu.Item>
              ))
            )}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {!useEntityView ? (
        <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Информация — {name}</DialogTitle>
            </DialogHeader>
            {fullSizeEl}
            <DialogFooter>
              <Button
                variant="secondary"
                className="mt-4 ml-auto"
                onClick={() => setInfoOpen(false)}
              >
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}