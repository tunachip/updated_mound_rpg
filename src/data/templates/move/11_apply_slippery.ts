import { applyStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const ApplySlippery = createBasicUtilityMove({
	id: 'move_apply_slippery',
	name: 'Apply Slippery',
	description: 'Apply slick to 1 enemy.',
	element: 'water',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'slick', amount: 1 },
		}),
	],
});
