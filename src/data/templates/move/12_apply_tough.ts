import {
	applyCooldownTurns,
	applyStatusTurns,
	operation,
	selfMoveTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: apply 2 tough to self or ally, then 2 cooldown turns to this move

export const ApplyTough = createBasicUtilityMove({
	id: 'move_apply_tough',
	name: 'Apply Tough',
	description: 'Apply 2 tough to self or 1 ally. Cooldown 2.',
	element: 'stone',
	targetType: {
		type: 'friend',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'tough', amount: 2 },
		}),
		operation(applyCooldownTurns, {
			ctx: { amount: 2 },
			targets: selfMoveTargets(),
		}),
	],
});
