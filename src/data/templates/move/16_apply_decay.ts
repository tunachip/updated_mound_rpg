import { applyStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const ApplyDecay = createBasicUtilityMove({
	id: 'move_apply_decay',
	name: 'Apply Decay',
	description: 'Apply decay to 1 enemy.',
	element: 'force',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'decay', amount: 1 },
		}),
	],
});
