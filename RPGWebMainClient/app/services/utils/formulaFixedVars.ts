import { FormulaVarCreate, FixedVarValue } from "@/app/services/types/rules";

export function extractFixedVars(
  variables: FormulaVarCreate[],
  values: Record<string, any>,
  activeVars: Record<string, boolean>
): FixedVarValue[] {
  const result: FixedVarValue[] = [];

  for (const v of variables) {
    const isActive = activeVars[v.var_name] ?? false;
    if (!isActive) continue;

    const val = values[v.var_name];
    if (val === undefined || val === null) continue;

    switch (v.var_type) {
      case "bool":
        result.push({
          var_name: v.var_name,
          fixed_value: Boolean(val),
        });
        break;

      case "int_range":
      case "tuple":
        if (typeof val === "number" && !Number.isNaN(val)) {
          result.push({
            var_name: v.var_name,
            fixed_value: val,
          });
        }
        break;

      case "dict":
        // тут val должен быть ключом (string)
        if (typeof val === "string" && val.length > 0) {
          result.push({
            var_name: v.var_name,
            fixed_value: val,
          });
        }
        break;

      case "skill": {
        // UI value: { optional_skill?: string }
        const id = val;
        if (typeof id === "string" && id.length > 0) {
          result.push({
            var_name: v.var_name,
            fixed_value: id, // ВАЖНО: строка id
          });
        }
        break;
      }

      case "skill_group": {
        const id = val;
        if (typeof id === "string" && id.length > 0) {
          result.push({
            var_name: v.var_name,
            fixed_value: id, // строка id
          });
        }
        break;
      }

      case "body": {
        // UI value: { is_self: boolean, optional_body?: string }
        const id = val;
        // договоримся: фиксируем body только если выбран конкретный body id
        if (typeof id === "string" && id.length > 0) {
          result.push({
            var_name: v.var_name,
            fixed_value: id, // строка id
          });
        }
        break;
      }

      case "body_skill": {
        // UI value: { value:number, optional_body?: string, optional_skill?: string }
        const n = val?.value;
        const bodyId = val?.optional_body;
        const skillId = val?.optional_skill;

        if (
          typeof n === "number" &&
          !Number.isNaN(n) &&
          typeof bodyId === "string" &&
          bodyId.length > 0 &&
          typeof skillId === "string" &&
          skillId.length > 0
        ) {
          result.push({
            var_name: v.var_name,
            fixed_value: n,          // число (int)
            optional_body: bodyId,   // UUID строкой
            optional_skill: skillId, // UUID строкой
          } as FixedVarValue);
        }
        break;
      }

      default:
        // если появятся ещё типы — добавишь
        break;
    }
  }

  return result;
}
