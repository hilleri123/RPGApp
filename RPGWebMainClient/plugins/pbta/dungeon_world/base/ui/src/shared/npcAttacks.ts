/** Атаки NPC сцены: зеркало серверного `npc_attack_options` (id совпадают с бэкендом). */

export type NpcAttackOption = {
  id: string;
  name: string;
  damage: string;
  rangeTags: string[];
  attackTags: string[];
  description: string;
};

export function describeNpcAttack(
  name: string,
  damage: string,
  rangeTags: string[],
  attackTags: string[],
): string {
  const tags = [...rangeTags, ...attackTags].filter(Boolean);
  let text = name || 'Атака';
  if (damage) text += ` — ${damage}`;
  if (tags.length) text += ` · ${tags.join(', ')}`;
  return text;
}

/** Атаки NPC с формулой урона (без неё бросать нечего). */
export function npcAttackOptions(npc: any): NpcAttackOption[] {
  const data = npc?.data && typeof npc.data === 'object' ? npc.data : {};
  const raw: any[] = Array.isArray(data.attacks) ? data.attacks : Array.isArray(npc?.attacks) ? npc.attacks : [];
  const result: NpcAttackOption[] = [];
  raw.forEach((atk, idx) => {
    if (!atk || typeof atk !== 'object') return;
    const damage = String(atk.damage_expr || atk.damage || '').trim();
    if (!damage) return;
    const name = String(atk.name || `Атака ${idx + 1}`);
    const rangeTags = (Array.isArray(atk.range_tags) ? atk.range_tags : []).map(String);
    const attackTags = (Array.isArray(atk.attack_tags) ? atk.attack_tags : []).map(String);
    result.push({
      id: String(atk.id || atk.name || `atk_${idx}`),
      name,
      damage,
      rangeTags,
      attackTags,
      description: describeNpcAttack(name, damage, rangeTags, attackTags),
    });
  });
  return result;
}

export function npcAttacksById(scene: any, npcId: string): NpcAttackOption[] {
  const npc = (scene?.npcs ?? []).find((n: any) => String(n.id) === String(npcId));
  return npc ? npcAttackOptions(npc) : [];
}

/** Тег «игнорирует броню» в разных написаниях. */
export function attackIgnoresArmor(attack: Pick<NpcAttackOption, 'attackTags'> | null | undefined): boolean {
  return (attack?.attackTags ?? []).some((t) => /ignores?[\s_-]*armou?r/i.test(t));
}
