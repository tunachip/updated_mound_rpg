import { negateStatus, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const NegateAnger = createBasicUtilityMove({
	id: 'move_negate_anger',
	name: 'Negate Anger',
	description: 'Remove anger from 1 ally.',
	element: 'vital',
	targetType: {
		type: 'ally',
		range: [1, 1],
	},
	operations: [
		operation(negateStatus, {
			ctx: { status: 'anger' },
		}),
	],
});
