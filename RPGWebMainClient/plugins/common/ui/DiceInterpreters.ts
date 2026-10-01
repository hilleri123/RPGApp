import type { DiceInterpreter } from './DiceRollDisplay';

/** Без оценки исхода: кубы просто показываются нейтральным цветом. */
export const neutralDiceInterpreter: DiceInterpreter = ({ dice }) => ({
  dieColors: dice.map(() => 'neutral' as const),
  outcome: null,
});
