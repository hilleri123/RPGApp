'use client';

import React, { useState, useMemo } from 'react';
import { useScenario } from '@/app/components/scenarios/ScenarioContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckSquare, Square, Trash2, Plus, ChevronDown } from 'lucide-react';
import type { ScenarioTodo, TodoCreate, TodoElementType, TodoPriority } from '@/app/services/types2';

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high:   '🔴 Высокий',
  medium: '🟡 Средний',
  low:    '⚪ Низкий',
};

const ELEMENT_TYPE_LABEL: Record<TodoElementType, string> = {
  location:       'Локация',
  scene:          'Сцена',
  npc:            'НПС',
  item:           'Предмет',
  story_beat:     'Сюжет',
  scene_exposure: 'Экспозиция',
  character:      'Персонаж',
  map_polygon:    'Полигон',
  audio_track:    'Трек',
  scenario:       'Сценарий',
  counter:        'Счётчик',
  note:           'Заметка',
  other:          'Другое',
};

function TodoItem({ todo, readOnly }: { todo: ScenarioTodo; readOnly: boolean }) {
  const { toggleTodoDone, deleteTodo, patchTodo } = useScenario();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(todo.text);

  const save = async () => {
    if (text.trim() && text !== todo.text) await patchTodo(todo.id, { text: text.trim() });
    setEditing(false);
  };

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
      todo.is_done
        ? 'border-white/5 bg-white/2 opacity-50'
        : 'border-white/10 bg-white/5'
    }`}>
      <button
        onClick={() => !readOnly && toggleTodoDone(todo.id)}
        disabled={readOnly}
        className="mt-0.5 shrink-0 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
      >
        {todo.is_done
          ? <CheckSquare className="w-4 h-4 text-green-500" />
          : <Square className="w-4 h-4" />}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void save(); }}}
            autoFocus
            className="text-sm bg-transparent border-white/20 resize-none min-h-0"
            rows={2}
          />
        ) : (
          <div
            className={`text-sm transition-colors ${readOnly ? 'text-gray-200' : 'cursor-pointer hover:text-white'} ${todo.is_done ? 'line-through text-gray-500' : 'text-gray-200'}`}
            onClick={() => !readOnly && setEditing(true)}
          >
            {todo.text}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {todo.element_type !== 'other' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
              {ELEMENT_TYPE_LABEL[todo.element_type]}
              {todo.element_name ? `: ${todo.element_name}` : ''}
            </span>
          )}
          <span className="text-[10px] text-gray-600">
            {PRIORITY_LABEL[todo.priority]}
          </span>
          {todo.note && (
            <span className="text-[10px] text-gray-500 italic truncate max-w-[200px]">{todo.note}</span>
          )}
        </div>
      </div>

      {!readOnly ? (
        <button
          onClick={() => deleteTodo(todo.id)}
          className="shrink-0 text-gray-600 hover:text-red-400 transition-colors mt-0.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function AddTodoForm({ onClose }: { onClose: () => void }) {
  const { createTodo } = useScenario();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [elementType, setElementType] = useState<TodoElementType>('other');
  const [elementName, setElementName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await createTodo({
        text: text.trim(),
        priority,
        element_type: elementType,
        element_name: elementName.trim() || null,
      } satisfies TodoCreate);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-xl p-3 bg-white/5 space-y-2">
      <Textarea
        placeholder="Что нужно сделать?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        rows={2}
        className="bg-transparent border-white/20 text-sm resize-none"
      />

      <div className="flex gap-2 flex-wrap">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TodoPriority)}
          className="text-xs bg-[#0b1020] border border-white/10 rounded px-2 py-1 text-gray-300"
        >
          {(Object.keys(PRIORITY_LABEL) as TodoPriority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>

        <select
          value={elementType}
          onChange={(e) => setElementType(e.target.value as TodoElementType)}
          className="text-xs bg-[#0b1020] border border-white/10 rounded px-2 py-1 text-gray-300"
        >
          {(Object.keys(ELEMENT_TYPE_LABEL) as TodoElementType[]).map((t) => (
            <option key={t} value={t}>{ELEMENT_TYPE_LABEL[t]}</option>
          ))}
        </select>

        {elementType !== 'other' && (
          <input
            placeholder="Название объекта"
            value={elementName}
            onChange={(e) => setElementName(e.target.value)}
            className="text-xs bg-[#0b1020] border border-white/10 rounded px-2 py-1 text-gray-300 flex-1 min-w-[120px]"
          />
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Отмена</Button>
        <Button size="sm" onClick={submit} disabled={!text.trim() || saving} className="text-xs">
          Добавить
        </Button>
      </div>
    </div>
  );
}

export function TodoTab() {
  const { todos, todosLoading, canEditEntities } = useScenario();
  const readOnly = !canEditEntities;
  const [addOpen, setAddOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const pending = useMemo(() => todos.filter((t) => !t.is_done), [todos]);
  const done    = useMemo(() => todos.filter((t) => t.is_done), [todos]);

  if (todosLoading) {
    return <div className="text-gray-500 text-sm p-4">Загрузка...</div>;
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">
          Todo
          {pending.length > 0 && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400">
              {pending.length}
            </span>
          )}
        </h2>
        {!readOnly ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAddOpen((v) => !v)}
            className="gap-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </Button>
        ) : null}
      </div>

      {addOpen && <AddTodoForm onClose={() => setAddOpen(false)} />}

      {pending.length === 0 && !addOpen && (
        <div className="text-gray-600 text-sm py-6 text-center">
          Нет активных задач 🎉
        </div>
      )}

      <div className="space-y-1.5">
        {pending.map((t) => <TodoItem key={t.id} todo={t} readOnly={readOnly} />)}
      </div>

      {done.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors mt-2"
            onClick={() => setShowDone((v) => !v)}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showDone ? '' : '-rotate-90'}`} />
            Выполнено ({done.length})
          </button>

          {showDone && (
            <div className="space-y-1.5 mt-1.5">
              {done.map((t) => <TodoItem key={t.id} todo={t} readOnly={readOnly} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}