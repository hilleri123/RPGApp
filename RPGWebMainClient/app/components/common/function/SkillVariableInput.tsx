import React, { useMemo, useEffect, useState } from "react";
import { Skill, SkillGroup, FormulaVarCreateSkill } from "@/app/services/types/rules";

interface Props {
  variable: FormulaVarCreateSkill;
  value: string | undefined;
  onChange: (change: string | undefined) => void; // <-- лучше так
  skillGroups: SkillGroup[];
  disabled?: boolean;
  required?: boolean;
}

export function SkillVariableInput({
  variable,
  value,
  onChange,
  skillGroups,
  disabled,
  required,
}: Props) {
  const skillsFlat: Skill[] = useMemo(
    () => (skillGroups ?? []).flatMap((g) => g.skills ?? []),
    [skillGroups]
  );

  const allowedGroupIds = useMemo(
    () => new Set(variable.value.groups ?? []),
    [variable.value.groups]
  );
  const allowedSkillIds = useMemo(
    () => new Set(variable.value.skills ?? []),
    [variable.value.skills]
  );

  const filteredSkills = useMemo(() => {
    if (variable.value.all) return skillsFlat;

    let allowed: Skill[] = [];

    if (allowedGroupIds.size > 0) {
      allowed = (skillGroups ?? [])
        .filter((g) => allowedGroupIds.has(g.id))
        .flatMap((g) => g.skills ?? []);
    }

    if (allowedSkillIds.size > 0) {
      const explicit = skillsFlat.filter((s) => allowedSkillIds.has(s.id));
      const exists = new Set(allowed.map((s) => s.id));
      return [...allowed, ...explicit.filter((s) => !exists.has(s.id))];
    }

    return allowed;
  }, [variable.value.all, allowedGroupIds, allowedSkillIds, skillGroups, skillsFlat]);

  const [selectedSkillId, setSelectedSkillId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // 1) если пришло value извне и оно валидное — используем его
    if (value && filteredSkills.some((s) => s.id === value)) {
      setSelectedSkillId(value);
      return;
    }

    // 2) если required и ещё ничего не выбрано — поставим первый доступный
    if (required && filteredSkills.length > 0) {
      setSelectedSkillId(filteredSkills[0].id);
      return;
    }

    // 3) иначе (не required) оставляем пустым
    setSelectedSkillId(undefined);
  }, [filteredSkills, value, required]);

  // sync outward: НЕ пушим пустую строку
  useEffect(() => {
    onChange(selectedSkillId);
  }, [selectedSkillId, onChange]);

  useEffect(() => {
    console.log("INIT", variable.var_name, variable.var_type, "value=", value, "var.value=", variable.value);
  }, [variable.var_name, value, variable.var_type, variable.value]);

  return (
    <div className="flex gap-2 items-center">
      <select
        value={selectedSkillId}
        onChange={(e) => setSelectedSkillId(e.target.value)}
        disabled={disabled}
        required={required}
        className="bg-gray-700 rounded px-2 py-1 border text-white"
      >
        {!required && <option value="">-- скилл --</option>}

        {filteredSkills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <span className="text-xs text-gray-300">
        {variable.value.all ? "Разрешены все" : `Доступно: ${filteredSkills.length}`}
      </span>
    </div>
  );
}
