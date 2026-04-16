import { applyStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const ApplyRegen = createBasicUtilityMove({
	id: 'move_apply_regen',
	name: 'Apply Regen',
	description: 'Apply regen to 1 ally.',
	element: 'plant',
	targetType: {
		type: 'ally',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'regen', amount: 1 },
		}),
	],
});
