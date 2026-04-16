import { applyStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const ApplyStrong = createBasicUtilityMove({
	id: 'move_apply_strong',
	name: 'Apply Strong',
	description: 'Apply strong to 1 ally.',
	element: 'stone',
	targetType: {
		type: 'ally',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'strong', amount: 1 },
		}),
	],
});
