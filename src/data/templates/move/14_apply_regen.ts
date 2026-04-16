import {
	applyStatusTurns,
	bankMoves,
	operation,
	selfMoveTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: applies to caster or ally, then bank this move

export const ApplyRegen = createBasicUtilityMove({
	id: 'move_apply_regen',
	name: 'Apply Regen',
	description: 'Apply 3 regen to self or 1 ally, then bank this move.',
	element: 'plant',
	targetType: {
		type: 'friend',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'regen', amount: 3 },
		}),
		operation(bankMoves, {
			targets: selfMoveTargets(),
		}),
	],
});
