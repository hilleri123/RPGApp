import type { ScenarioTemplateListItem } from '@/app/services/types2/template_entity';

export function templatePackChipFromItem(item: ScenarioTemplateListItem) {
  if (!item.template_pack_name && !item.template_pack_id) return undefined;
  return {
    name: item.template_pack_name || 'Без пака',
    isPrimary: Boolean(item.is_primary_pack),
  };
}
