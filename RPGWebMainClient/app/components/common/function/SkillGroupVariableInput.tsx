import React, { useMemo, useEffect, useState } from "react";
import { SkillGroup, FormulaVarCreateSkillGroup } from "@/app/services/types/rules";


interface Props {
  variable: FormulaVarCreateSkillGroup;
  value: string;
  onChange: (change: string) => void;
  skillGroups: SkillGroup[];
  disabled?: boolean;
  required?: boolean;
}

export function SkillGroupVariableInput({
  variable,
  value,
  onChange,
  skillGroups,
  disabled,
  required,
}: Props) {
  const allowedIds = useMemo(
    () => new Set(variable.value.group_ids ?? []),
    [variable.value.group_ids]
  );

  const filteredGroups = useMemo(() => {
    if (!variable.value.group_ids || variable.value.group_ids.length === 0) return skillGroups;
    return skillGroups.filter((g) => allowedIds.has(g.id));
  }, [skillGroups, allowedIds, variable.value.group_ids]);

  const [selectedGroupId, setSelectedGroupId] = useState<string>(value ?? "");

  // 1) синхронизация из пропсов + автоселект если 1 вариант
  useEffect(() => {
    // если родитель задал значение — уважаем
    if (value) {
      if (value !== selectedGroupId) setSelectedGroupId(value);
      return;
    }

    // если вариантов ровно 1 — автосетим
    if (filteredGroups.length === 1) {
      const only = filteredGroups[0].id;
      if (only !== selectedGroupId) setSelectedGroupId(only);
      return;
    }

    // если текущий выбранный стал недоступен — сброс
    if (selectedGroupId && !filteredGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGroups, value]);

  // 2) пуш наверх только если реально отличается от того, что уже в родителе
  useEffect(() => {
    const next = selectedGroupId;
    const curr = value || undefined;
    if (next === curr) return;

    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, value]);

  // 3) цвета: skillGroup.color (если есть), иначе fallback
  const groupColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of skillGroups) {
      m.set(g.id, (g as any).color ?? "#e5e7eb");
    }
    return m;
  }, [skillGroups]);

  return (
    <div className="flex gap-2 items-center">
      <select
        value={selectedGroupId}
        onChange={(e) => setSelectedGroupId(e.target.value)}
        disabled={disabled || filteredGroups.length === 1}
        required={required}
        className="bg-gray-700 rounded px-2 py-1 border text-white"
        style={{ color: groupColorById.get(selectedGroupId) ?? undefined }}
      >
        <option value="" style={{ color: "#9ca3af" }}>
          -- группа --
        </option>

        {filteredGroups.map((g) => (
          <option key={g.id} value={g.id} style={{ color: groupColorById.get(g.id) ?? undefined }}>
            {g.name}
          </option>
        ))}
      </select>

      <span className="text-xs text-gray-300">Доступно: {filteredGroups.length}</span>
    </div>
  );
}
