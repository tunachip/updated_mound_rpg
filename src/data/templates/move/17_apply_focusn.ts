import {
	applyStatusTurns,
	operation,
	selfAndAdjacentTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: applies focus to self and entities to the left and right

export const ApplyFocus = createBasicUtilityMove({
	id: 'move_apply_focus',
	name: 'Apply Focus',
	description: 'Apply focus to self and adjacent allies.',
	element: 'thunder',
	targetType: {
		type: 'self',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'focus', amount: 1 },
			targets: selfAndAdjacentTargets(),
		}),
	],
});
