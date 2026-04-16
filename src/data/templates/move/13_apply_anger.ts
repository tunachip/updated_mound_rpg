import { applyStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const ApplyAnger = createBasicUtilityMove({
	id: 'move_apply_anger',
	name: 'Apply Anger',
	description: 'Apply anger to 1 enemy.',
	element: 'fire',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'anger', amount: 1 },
		}),
	],
});
