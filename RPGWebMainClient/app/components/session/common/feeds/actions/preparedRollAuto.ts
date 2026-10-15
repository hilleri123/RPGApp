/** Стадии, где запас уходит сам, без отдельного выбора на этом шаге. */

type WorkflowLike = {
  context?: Record<string, any>;
} | null | undefined;

function diceReady(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function preparedRollAutoPayload(args: {
  stageKey: string;
  workflow: WorkflowLike;
  stock: number;
  viewerId: string;
}): Record<string, unknown> | null {
  if (args.stock < 1) return null;
  const ctx = args.workflow?.context ?? {};
  const entry = ctx.entry ?? {};
  const viewer = String(args.viewerId ?? '');

  switch (args.stageKey) {
    case 'common.free_dice_roll.roll': {
      if (diceReady(ctx.roll?.dice)) return null;
      const actor = String(ctx.actor_user_id ?? ctx.actorUserId ?? '');
      if (actor && actor !== viewer) return null;
      return { usePreparedSeed: true };
    }
    case 'gumshoe.attack.roll': {
      if (diceReady(entry.dice)) return null;
      if (String(entry.attackerUserId ?? '') !== viewer) return null;
      return { usePreparedSeed: true };
    }
    case 'gumshoe.attack.damage': {
      if (diceReady(entry.damage_rolls)) return null;
      if (String(entry.attackerUserId ?? '') !== viewer) return null;
      return { usePreparedSeed: true };
    }
    case 'john.action.canvas': {
      if (diceReady(entry.dice_results)) return null;
      if (String(entry.playerUserId ?? '') !== viewer) return null;
      return { usePreparedSeed: true };
    }
    case 'initiative.tie_canvas':
      return { usePreparedSeed: true };
    default:
      return null;
  }
}
