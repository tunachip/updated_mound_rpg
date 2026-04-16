import { negateAttunement, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const NegateThunderAttunement = createBasicUtilityMove({
	id: 'move_negate_thunder_attunement',
	name: 'Negate Thunder Attunement',
	description: 'Remove thunder attunement from 1 enemy.',
	element: 'stone',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	operations: [
		operation(negateAttunement, {
			ctx: { element: 'thunder' },
		}),
	],
});
