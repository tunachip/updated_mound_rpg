import { applyStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const ApplyFocus = createBasicUtilityMove({
	id: 'move_apply_focus',
	name: 'Apply Focus',
	description: 'Apply focus to 1 ally.',
	element: 'plant',
	targetType: {
		type: 'ally',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'focus', amount: 1 },
		}),
	],
});
