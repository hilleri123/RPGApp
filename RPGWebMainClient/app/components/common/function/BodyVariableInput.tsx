import React, { useMemo, useEffect, useState } from "react";
import { Body, FormulaVarCreateBody } from "@/app/services/types/rules";

interface BodyValue {
  optional_body?: string; // id тела
  is_self?: boolean;
}

interface Props {
  variable: FormulaVarCreateBody;
  value: BodyValue | undefined;
  onChange: (change: BodyValue) => void;
  bodies: Body[];
  disabled?: boolean;
  required?: boolean;
}

export function BodyVariableInput({
  variable,
  value,
  onChange,
  bodies,
  disabled,
  required,
}: Props) {
  const availableBodies = useMemo(() => bodies, [bodies]);

  const [selectedBodyId, setSelectedBodyId] = useState<string>("");

  useEffect(() => {
    if (value?.optional_body && availableBodies.find((b) => b.id === value.optional_body)) {
      setSelectedBodyId(value.optional_body);
      return;
    }
    if ((!selectedBodyId || !availableBodies.find((b) => b.id === selectedBodyId)) && availableBodies.length === 1) {
      setSelectedBodyId(availableBodies[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableBodies, value?.optional_body]);

  useEffect(() => {
    onChange({
      is_self: variable.value.is_self,
      optional_body: selectedBodyId || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBodyId, variable.value.is_self]);

  const isSelf = variable.value.is_self;

  return (
    <div className="flex gap-2 items-center">
      <span className="text-xs text-gray-300">
        {isSelf ? "Тело: Self" : "Тело:"}
      </span>

      <select
        value={selectedBodyId}
        onChange={(e) => setSelectedBodyId(e.target.value)}
        disabled={disabled || availableBodies.length === 1}
        required={required && !isSelf}
        className="bg-gray-700 rounded px-2 py-1 border text-white"
      >
        <option value="">{isSelf ? "-- (необязательно) --" : "-- тело --"}</option>
        {availableBodies.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
