// app/services/types2.ts
export type RuleSystemInfo = {
  plugin_id: string | null;
  plugin_name: string | null;
  plugin_version: string | null;
  module_name: string;
  plugin_root: string;
  // allow extra fields from describe()
  [k: string]: any;
};
