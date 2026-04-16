import {
	applyCooldownTurns,
	negatePreferredStatus,
	operation,
	selfMoveTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: instead of negating anger, this should negate a chosen status
// after this, applies 2 cooldown turns to this move

export const NegateAnger = createBasicUtilityMove({
	id: 'move_negate_anger',
	name: 'Negate Status',
	description: 'Remove 1 chosen status from self or 1 ally. Cooldown 2.',
	element: 'water',
	targetType: {
		type: 'friend',
		range: [1, 1],
	},
	operations: [
		operation(negatePreferredStatus, {
			name: 'negateStatus',
		}),
		operation(applyCooldownTurns, {
			ctx: { amount: 2 },
			targets: selfMoveTargets(),
		}),
	],
});
