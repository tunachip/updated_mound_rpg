import {
	applyStatusTurns,
	operation,
	payEnergyForAdditionalStatusTurn,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: applies 1 decay to an enemy
// after thisk, the user may pay 2 energy to apply another decay

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
		operation(payEnergyForAdditionalStatusTurn, {
			ctx: { status: 'decay', amount: 2 },
		}),
	],
});
