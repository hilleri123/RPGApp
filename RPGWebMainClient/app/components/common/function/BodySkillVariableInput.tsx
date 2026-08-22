import React, { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Body, FormulaVarCreateBodySkill, Skill, SkillGroup } from "@/app/services/types/rules";

interface BodySkillValue {
  value: number;
  optional_body?: string;
  optional_skill?: string;
}

interface Props {
  variable: FormulaVarCreateBodySkill;
  value: BodySkillValue | undefined;
  onChange: (change: BodySkillValue) => void;
  bodies: Body[];
  skillGroups: SkillGroup[];
  disabled?: boolean;
  required?: boolean;
}

export function BodySkillVariableInput({
  variable,
  value,
  onChange,
  bodies,
  skillGroups,
  disabled,
  required,
}: Props) {
  const minVal = variable.value.left ?? 0;
  const maxVal = variable.value.right ?? 1;

  const availableBodies = useMemo(() => bodies, [bodies]);

  const [numValue, setNumValue] = useState<number>(() => value?.value ?? minVal);
  const [selectedBodyId, setSelectedBodyId] = useState<string>(value?.optional_body ?? "");
  const [selectedSkillId, setSelectedSkillId] = useState<string>(value?.optional_skill ?? "");

  // ---- helpers (MUST be before effects that use them)
  const current = useMemo(
    () => ({
      value: value?.value,
      optional_body: value?.optional_body,
      optional_skill: value?.optional_skill,
    }),
    [value?.value, value?.optional_body, value?.optional_skill]
  );

  function same(a: any, b: any) {
    return (
      a?.value === b?.value &&
      (a?.optional_body ?? undefined) === (b?.optional_body ?? undefined) &&
      (a?.optional_skill ?? undefined) === (b?.optional_skill ?? undefined)
    );
  }

  const emit = (next: { bodyId?: string; skillId?: string; val?: number }) => {
    const bodyId = next.bodyId ?? selectedBodyId;
    const skillId = next.skillId ?? selectedSkillId;
    const val = next.val ?? numValue;

    if (!bodyId || !skillId) return;

    const v0 = Number.isFinite(val) ? val : minVal;
    const v = Math.max(minVal, Math.min(inputMax, v0));

    const nextVal = { value: v, optional_body: bodyId, optional_skill: skillId };
    if (!same(nextVal, current)) onChange(nextVal);
  };


  // ---- selected body
  const selectedBody = useMemo(
    () => availableBodies.find((b) => b.id === selectedBodyId),
    [selectedBodyId, availableBodies]
  );

  // ---- skills logic
  const skills_flated: Skill[] = skillGroups.flatMap((g) => g.skills);
  const allowedGroupIds = new Set((variable.value as any)?.skill?.groups ?? []);
  const allowedSkillIds = new Set((variable.value as any)?.skill?.skills ?? []);

  const filteredSkills = useMemo(() => {
    if ((variable.value as any)?.skill?.all) return skills_flated;

    let allowed: Skill[] = [];
    if (allowedGroupIds.size > 0) {
      allowed = skillGroups
        .filter((g) => allowedGroupIds.has(g.id))
        .flatMap((g) => g.skills);
    }
    if (allowedSkillIds.size > 0) {
      const explicit = skills_flated.filter((s) => allowedSkillIds.has(s.id));
      const exists = new Set(allowed.map((s) => s.id));
      return [...allowed, ...explicit.filter((s) => !exists.has(s.id))];
    }
    return allowed;
  }, [skillGroups, skills_flated, allowedGroupIds, allowedSkillIds, variable.value]);

  const bodySkills = useMemo(() => {
    if (!selectedBody || !selectedBody.stats) return filteredSkills;
    const ids = new Set(selectedBody.stats.map((st) => st.skill_id));
    return filteredSkills.filter((s) => ids.has(s.id));
  }, [selectedBody, filteredSkills]);

  // ---- compute inputMax
  const statObj = selectedBody?.stats?.find((st) => st.skill_id === selectedSkillId);
  const hasStat = !!statObj;
  const statSkillMax = hasStat ? (statObj.value ?? statObj.init_value ?? 0) : 0;
  const inputMax = hasStat ? Math.min(maxVal, statSkillMax) : maxVal;

  // ---- init / autoset body from props or "single body"
  useEffect(() => {
    // 1) если value пришёл сверху — уважаем его
    if (value?.optional_body) {
      if (value.optional_body !== selectedBodyId) setSelectedBodyId(value.optional_body);
      return;
    }

    // 2) если тел ровно одно — автосетим
    if (availableBodies.length === 1) {
      const only = availableBodies[0].id;
      if (only !== selectedBodyId) setSelectedBodyId(only);
    }
  }, [value?.optional_body, availableBodies]); // <= убрали selectedBodyId из deps


  // ---- init / autoset skill from props or "single skill for body"
  useEffect(() => {
    // если value сверху задал skill и он валиден — берём его
    if (value?.optional_skill && bodySkills.some((s) => s.id === value.optional_skill)) {
      if (value.optional_skill !== selectedSkillId) setSelectedSkillId(value.optional_skill);
      return;
    }

    // автосет если skill ровно один
    if (bodySkills.length === 1) {
      const only = bodySkills[0].id;
      if (only !== selectedSkillId) setSelectedSkillId(only);
    }
  }, [value?.optional_skill, bodySkills]); // <= убрали selectedSkillId из deps


  // ---- sync numValue from props (only when props changes)
  const didInitNum = React.useRef(false);

  useEffect(() => {
    if (didInitNum.current) return;
    didInitNum.current = true;

    if (typeof value?.value === "number" && Number.isFinite(value.value)) {
      setNumValue(value.value);
    } else {
      setNumValue(minVal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minVal]);


  // ---- clamp local numValue when max/min changes (NO onChange here!)
  useEffect(() => {
    setNumValue((prev) => {
      let v = Number.isFinite(prev) ? prev : minVal;
      if (v > inputMax) v = inputMax;
      if (v < minVal) v = minVal;
      return v === prev ? prev : v;
    });
  }, [inputMax, minVal]);


  useEffect(() => {
    if (!selectedBodyId || !selectedSkillId) return;

    const v0 = Number.isFinite(numValue) ? numValue : minVal;
    const v = Math.max(minVal, Math.min(inputMax, v0));

    const nextVal = { value: v, optional_body: selectedBodyId, optional_skill: selectedSkillId };

    if (!same(nextVal, current)) {
      onChange(nextVal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBodyId, selectedSkillId, numValue, inputMax, minVal]);


  const skillColorById = useMemo(() => {
    const m = new Map<string, string>();

    for (const g of skillGroups) {
      const groupColor =
        (g as any).color // если есть
        ?? "#e5e7eb"; // fallback (gray-200)

      for (const s of g.skills) m.set(s.id, groupColor);
    }
    return m;
  }, [skillGroups]);

  
  return (
    <div className="flex gap-2 items-center">
      <select
        value={selectedBodyId}
        onChange={(e) => {
          const bodyId = e.target.value;
          setSelectedBodyId(bodyId);
          setSelectedSkillId("");
        }}
        disabled={disabled || availableBodies.length === 1}
        required={required}
        className="bg-gray-700 rounded px-2 py-1 border text-white"
      >
        <option value="">-- тело --</option>
        {availableBodies.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        value={selectedSkillId}
        onChange={(e) => {
          const skillId = e.target.value;
          setSelectedSkillId(skillId);
          emit({ skillId }); // <-- пушим один раз, без useEffect
        }}
        disabled={disabled || !selectedBodyId || bodySkills.length === 1}
        required={required}
        className="bg-gray-700 rounded px-2 py-1 border text-white"
        style={{ color: skillColorById.get(selectedSkillId) ?? undefined }}
      >
        <option value="" style={{ color: "#9ca3af" }}>-- скилл --</option>
        {bodySkills.map((s) => (
          <option
            key={s.id}
            value={s.id}
            style={{ color: skillColorById.get(s.id) ?? undefined }}
          >
            {s.name}
          </option>
        ))}
      </select>

      <Input
        type="number"
        value={Number.isFinite(numValue) ? numValue : ""}
        min={minVal}
        max={inputMax}
        placeholder={`${minVal}…${inputMax}`}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (!Number.isFinite(v)) v = minVal;
          if (v < minVal) v = minVal;
          if (v > inputMax) v = inputMax;

          setNumValue(v);
          emit({ val: v });
        }}
        disabled={disabled || !selectedBodyId || !selectedSkillId || inputMax <= minVal}
        required={required}
        className="w-16"
      />

      <span>{minVal} - {inputMax}</span>
    </div>
  );
}
