import {
	negatePreferredAttunementAndGrantEnergy,
	operation,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: instead of negating a target's attunement to thunder
// we negate an enemies attunement to a status of our choice
// after this, target gains 1 energy if a status was negated this way

export const NegateThunderAttunement = createBasicUtilityMove({
	id: 'move_negate_thunder_attunement',
	name: 'Negate Attunement',
	description: 'Remove 1 chosen attunement from 1 enemy. That enemy gains 1 energy.',
	element: 'fire',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	operations: [
		operation(negatePreferredAttunementAndGrantEnergy, {
			name: 'negateAttunement',
		}),
	],
});
