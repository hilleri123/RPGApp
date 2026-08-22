'use client';

import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ListTodo, CheckSquare, Square, Trash2, Plus, X } from 'lucide-react';
import { useScenarioOptional } from '@/app/components/scenarios/ScenarioContext';
import type { ScenarioTodo, TodoElementType, TodoPriority } from '@/app/services/types2';

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high:   'text-red-400',
  medium: 'text-yellow-400',
  low:    'text-gray-500',
};

const PRIORITY_DOT: Record<TodoPriority, string> = {
  high:   'bg-red-400',
  medium: 'bg-yellow-400',
  low:    'bg-gray-500',
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high:   'Высокий',
  medium: 'Средний',
  low:    'Низкий',
};

// Максимальная критичность из списка незакрытых
function maxPriority(todos: ScenarioTodo[]): TodoPriority | null {
  const open = todos.filter((t) => !t.is_done);
  if (!open.length) return null;
  if (open.some((t) => t.priority === 'high'))   return 'high';
  if (open.some((t) => t.priority === 'medium')) return 'medium';
  return 'low';
}

type Props = {
  elementType: TodoElementType;
  elementId: string;
  elementName: string;
};

type ScenarioTodoApi = NonNullable<ReturnType<typeof useScenarioOptional>>;

export function TodoPopover(props: Props) {
  const scenario = useScenarioOptional();
  if (!scenario) return null;
  return <TodoPopoverInner {...props} scenario={scenario} />;
}

function TodoPopoverInner({
  elementType,
  elementId,
  elementName,
  scenario,
}: Props & { scenario: ScenarioTodoApi }) {
  const { todos, createTodo, toggleTodoDone, deleteTodo } = scenario;
  const [open, setOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [saving, setSaving] = useState(false);

  // Только todo этого объекта
  const entityTodos = useMemo(
    () => todos.filter((t) => t.element_id === elementId),
    [todos, elementId],
  );

  const openTodos   = useMemo(() => entityTodos.filter((t) => !t.is_done), [entityTodos]);
  const doneTodos   = useMemo(() => entityTodos.filter((t) => t.is_done),  [entityTodos]);
  const topPriority = useMemo(() => maxPriority(entityTodos), [entityTodos]);

  const handleCreate = async () => {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      await createTodo({
        element_type: elementType,
        element_id:   elementId,
        element_name: elementName,
        text:         newText.trim(),
        priority:     newPriority,
      });
      setNewText('');
      setNewPriority('medium');
    } finally {
      setSaving(false);
    }
  };

  // Иконка-триггер
  const trigger = (
    <button
      className="relative flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/5 transition-colors group"
      title="Задачи"
    >
      <ListTodo className={`w-4 h-4 transition-colors ${
        topPriority ? PRIORITY_COLOR[topPriority] : 'text-gray-600 group-hover:text-gray-400'
      }`} />

      {openTodos.length > 0 && (
        <span className={`
          absolute -top-1 -right-1
          flex items-center justify-center
          min-w-[14px] h-[14px] px-0.5
          rounded-full text-[9px] font-bold text-black
          ${PRIORITY_DOT[topPriority!]}
        `}>
          {openTodos.length}
        </span>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 bg-[#0d1424] border border-white/10 shadow-xl"
        align="end"
        sideOffset={6}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs font-semibold text-gray-300">
            Задачи
            {openTodos.length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400">
                {openTodos.length} открыто
              </span>
            )}
          </span>
          <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {/* Открытые */}
          {openTodos.length > 0 && (
            <div className="px-2 pt-2 space-y-1">
              {openTodos.map((t) => (
                <TodoRow key={t.id} todo={t} onToggle={toggleTodoDone} onDelete={deleteTodo} />
              ))}
            </div>
          )}

          {/* Выполненные — свёрнуто */}
          {doneTodos.length > 0 && (
            <DoneTodos todos={doneTodos} onToggle={toggleTodoDone} onDelete={deleteTodo} />
          )}

          {entityTodos.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-gray-600">Нет задач</div>
          )}
        </div>

        {/* Форма добавления */}
        <div className="border-t border-white/10 p-2 space-y-1.5">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
            placeholder="Новая задача..."
            className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder-gray-600 outline-none focus:border-white/20"
          />
          <div className="flex gap-1.5">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
              className="flex-1 text-[11px] bg-white/5 border border-white/10 rounded px-1.5 py-1 text-gray-400"
            >
              {(Object.keys(PRIORITY_LABEL) as TodoPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newText.trim() || saving}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Plus className="w-3 h-3" />
              Добавить
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Строка одной задачи ──────────────────────────────────────────────────────

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: ScenarioTodo;
  onToggle: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className={`flex items-start gap-1.5 rounded-md px-1.5 py-1 group hover:bg-white/5 ${
      todo.is_done ? 'opacity-40' : ''
    }`}>
      {/* Dot приоритета */}
      <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[todo.priority]}`} />

      {/* Чекбокс */}
      <button
        onClick={() => void onToggle(todo.id)}
        className="shrink-0 mt-0.5 text-gray-500 hover:text-white transition-colors"
      >
        {todo.is_done
          ? <CheckSquare className="w-3.5 h-3.5 text-green-500" />
          : <Square className="w-3.5 h-3.5" />}
      </button>

      {/* Текст */}
      <span className={`flex-1 text-xs leading-snug ${
        todo.is_done ? 'line-through text-gray-600' : 'text-gray-300'
      }`}>
        {todo.text}
      </span>

      {/* Удалить */}
      <button
        onClick={() => void onDelete(todo.id)}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Выполненные (коллапс) ───────────────────────────────────────────────────

function DoneTodos({
  todos,
  onToggle,
  onDelete,
}: {
  todos: ScenarioTodo[];
  onToggle: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="px-2 pb-1">
      <button
        className="w-full text-left text-[10px] text-gray-600 hover:text-gray-400 py-1 transition-colors"
        onClick={() => setShow((v) => !v)}
      >
        {show ? '▾' : '▸'} Выполнено ({todos.length})
      </button>
      {show && (
        <div className="space-y-0.5">
          {todos.map((t) => (
            <TodoRow key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}