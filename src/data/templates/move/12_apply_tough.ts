import { applyStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const ApplyTough = createBasicUtilityMove({
	id: 'move_apply_tough',
	name: 'Apply Tough',
	description: 'Apply tough to 1 ally.',
	element: 'stone',
	targetType: {
		type: 'ally',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'tough', amount: 1 },
		}),
	],
});
