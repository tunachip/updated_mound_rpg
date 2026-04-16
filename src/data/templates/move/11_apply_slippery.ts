import {
	applyCooldownTurns,
	applyStatusTurns,
	operation,
	selfMoveTargets,
	selfTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: applies 2 slick to self, then 2 cooldown turns to this move

export const ApplySlippery = createBasicUtilityMove({
	id: 'move_apply_slippery',
	name: 'Apply Slippery',
	description: 'Apply 2 slick to self. Cooldown 2.',
	element: 'water',
	targetType: {
		type: 'self',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'slick', amount: 2 },
			targets: selfTargets(),
		}),
		operation(applyCooldownTurns, {
			ctx: { amount: 2 },
			targets: selfMoveTargets(),
		}),
	],
});
