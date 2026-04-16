import { negateExtraIterations, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const NegateExtraIterations = createBasicUtilityMove({
	id: 'move_negate_extra_iterations',
	name: 'Negate Extra Iterations',
	description: 'Remove extra iterations from 1 enemy.',
	element: 'thunder',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	operations: [
		operation(negateExtraIterations),
	],
});
