import type { LocationList } from '@/app/services/types2';

export type LocationTabCommonProps = {
  dlg: any;
  editingId: string | null | undefined;
};

export type LocationSceneTabProps = {
  dlg: any;
  scenarioId: string;
};

export type LocationRulesTabProps = {
  dlg: any;
  pluginUI: any;
};

export type LocationSublocTabProps = {
  dlg: any;
  editingId: string | null | undefined;
};

export type ChildLocationsGetter = (locations: LocationList[], editingId: string) => LocationList[];