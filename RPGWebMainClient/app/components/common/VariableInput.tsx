'use client'

import React, { useEffect, useRef } from "react";
import { FormulaVarCreate, SkillGroup, Body } from "@/app/services/types/rules";
import { Input } from "@/components/ui/input";

import { SkillVariableInput } from "./function/SkillVariableInput";
import { SkillGroupVariableInput } from "./function/SkillGroupVariableInput";
import { BodyVariableInput } from "./function/BodyVariableInput";
import { BodySkillVariableInput } from "./function/BodySkillVariableInput";

function parseIntRange(val: any): [number | undefined, number | undefined] {
  if (typeof val === "object" && val !== null && ("left" in val) && ("right" in val)) {
    return [val.left, val.right];
  }
  if (!val) return [undefined, undefined];
  const parts = String(val).split(":");
  if (parts.length === 2) {
    const min = Number(parts[0]);
    const max = Number(parts[1]);
    if (!isNaN(min) && !isNaN(max)) return [min, max];
  }
  return [undefined, undefined];
}

interface VariableInputProps {
  variable: FormulaVarCreate;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  required?: boolean;
  bodies: Body[];
  skillGroups: SkillGroup[];
}

export function VariableInput({
  variable,
  value,
  onChange,
  disabled,
  required,
  bodies,
  skillGroups,
}: VariableInputProps) {
  const didInit = useRef<string | null>(null);

  useEffect(() => {
    console.log("V INIT", variable.var_name, variable.var_type, "value=", value, "var.value=", variable.value);
  }, [variable.var_name, value, variable.var_type, variable.value]);


  // Инициализация значения (только если value ещё undefined)
  useEffect(() => {
    if (didInit.current === variable.var_name) return;
    if (value !== undefined) {
      didInit.current = variable.var_name;
      return;
    }

    switch (variable.var_type) {
      case "int_range": {
        const [min] = parseIntRange(variable.value);
        if (min !== undefined) onChange(min);
        break;
      }

      case "bool":
        onChange(Boolean(variable.value ?? false));
        break;

      case "tuple": {
        const opts = Array.isArray(variable.value) ? variable.value : [];
        if (opts.length) onChange(opts[0]);
        break;
      }

      case "dict": {
        const dict: Record<string, any> = typeof variable.value === "object" && variable.value ? variable.value : {};
        const firstKey = Object.keys(dict)[0];
        if (firstKey !== undefined) onChange(firstKey);
        break;
      }

      case "skill":
        onChange(variable.value);
        break;

      case "skill_group":
        onChange(variable.value);
        break;

      // body возвращает { is_self, optional_body }
      case "body":
        onChange({ is_self: Boolean(variable.value?.is_self ?? false), optional_body: undefined });
        break;

      // body_skill как у тебя: { value, optional_body, optional_skill }
      case "body_skill":
        onChange(undefined);
        break;

      default:
        break;
    }

    didInit.current = variable.var_name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variable.var_name]);

  switch (variable.var_type) {
    case "int_range": {
      const [min, max] = parseIntRange(variable.value);
      const options =
        min !== undefined && max !== undefined
          ? Array.from({ length: max - min + 1 }, (_, i) => min + i)
          : [];

      return (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          disabled={disabled}
          required={required}
          className="bg-gray-800 rounded px-2 py-1 border text-white"
        >
          <option value="">
            {min !== undefined && max !== undefined ? `Выбери (${min}…${max})` : "Выбери значение"}
          </option>
          {options.map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
      );
    }

    case "bool":
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          style={{ width: 24, height: 24 }}
        />
      );

    case "tuple": {
      const options: any[] = Array.isArray(variable.value) ? variable.value : [];
      return (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          disabled={disabled}
          required={required}
          className="bg-gray-800 rounded px-2 py-1 border text-white"
        >
          {options.map((opt, i) => (
            <option key={String(opt) + i} value={opt}>
              {String(opt)}
            </option>
          ))}
        </select>
      );
    }

    case "dict": {
      const dict: Record<string, any> = typeof variable.value === "object" && variable.value ? variable.value : {};
      return (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          disabled={disabled}
          required={required}
          className="bg-gray-800 rounded px-2 py-1 border text-white"
        >
          {Object.entries(dict).map(([key, val]) => (
            <option key={key} value={key}>
              {key}: {String(val)}
            </option>
          ))}
        </select>
      );
    }

    case "skill":
      return (
        <SkillVariableInput
          variable={variable}
          value={value}
          onChange={onChange}
          skillGroups={skillGroups}
          disabled={disabled}
          required={required}
        />
      );

    case "skill_group":
      return (
        <SkillGroupVariableInput
          variable={variable}
          value={value}
          onChange={onChange}
          skillGroups={skillGroups}
          disabled={disabled}
          required={required}
        />
      );

    case "body":
      return (
        <BodyVariableInput
          variable={variable}
          value={value}
          onChange={onChange}
          bodies={bodies}
          disabled={disabled}
          required={required}
        />
      );

    case "body_skill":
      return (
        <BodySkillVariableInput
          variable={variable}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          bodies={bodies}
          skillGroups={skillGroups}
        />
      );

    default:
      return (
        <Input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          className="w-28"
        />
      );
  }
}
