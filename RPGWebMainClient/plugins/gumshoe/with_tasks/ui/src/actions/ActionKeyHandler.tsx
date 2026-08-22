'use client';

import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { JSX } from 'react';

// базовый ActionKeyHandler и его карта обработчиков
import BaseActionKeyHandler, {
  HANDLERS as BASE_HANDLERS,
} from '../../../../base/ui/src/actions/ActionKeyHandler';
import TaskBonusStage from './task_bonus/TaskBonusStage';

// твои стадии


type Handler = (props: ActionHandlerProps) => JSX.Element;

// дополняем базовые хендлеры своими
const EXTRA_HANDLERS: Record<string, Handler> = {
  'gumshoe.task_bonus': TaskBonusStage,
};

// итоговая карта: базовые + переопределения/добавления
export const HANDLERS: Record<string, Handler> = {
  ...BASE_HANDLERS,
  ...EXTRA_HANDLERS,
};

export default function ActionKeyHandler(props: ActionHandlerProps) {
  const key = String(props?.action?.actionKey ?? '');
  const Cmp = HANDLERS[key];

  if (!Cmp) {
    // можно просто отдать базовый, он уже умеет показывать "нет обработчика"
    return <BaseActionKeyHandler {...props} />;
  }

  return <Cmp {...props} />;
}