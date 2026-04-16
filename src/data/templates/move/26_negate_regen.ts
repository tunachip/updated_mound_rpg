import { negateStatus, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const NegateRegen = createBasicUtilityMove({
	id: 'move_negate_regen',
	name: 'Negate Regen',
	description: 'Remove regen from 1 enemy.',
	element: 'force',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	operations: [
		operation(negateStatus, {
			ctx: { status: 'regen' },
		}),
	],
});
