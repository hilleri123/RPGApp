import { LucideIcon, Package, User, MapPin, Crown, PersonStanding, Skull, Smile, ActivityIcon, Hash, StickyNote, VenetianMask } from "lucide-react";




export const TYPE_ICONS = {
  story_beat: ActivityIcon,
  item: Package,
  user: User,
  location: MapPin,
  character: Crown,
  npc: User,
  enemy_npc: VenetianMask,
  dead_npc: Skull,
  obstacle: ActivityIcon,
  note: StickyNote,
  counter: Hash,
};


export const TYPE_COLORS = {
  story_beat: "#ffffff",
  item: "#a259ff",
  user: "#fbbf24",
  location: "#663300",
  character: "#388ff7",
  npc: "#42d17e",
  enemy_npc: "#f44436",
  dead_npc: "#525252",
  enemy_dead_npc: "#1a0000",
  obstacle: "#f59e0b",
  note: "#388ff7",
  counter: "#388ff7",
};

interface NpcStyle {
  color: string;
  icon: LucideIcon;
};

export function getNpcStyle(is_dead: Boolean, is_enemy: Boolean): NpcStyle {
  if (!is_dead && !is_enemy) return { color: TYPE_COLORS.npc, icon: TYPE_ICONS.npc };
  if (!is_dead && is_enemy)  return { color: TYPE_COLORS.enemy_npc, icon: TYPE_ICONS.enemy_npc };
  if (is_dead && !is_enemy)  return { color: TYPE_COLORS.dead_npc, icon: TYPE_ICONS.dead_npc };
  if (is_dead && is_enemy)   return { color: TYPE_COLORS.enemy_dead_npc, icon: TYPE_ICONS.dead_npc };
  return { color: TYPE_COLORS.npc, icon: TYPE_ICONS.npc };
}