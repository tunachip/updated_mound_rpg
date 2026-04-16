import {
	bankMoves,
	operation,
	selfMoveTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: sets move.isBanked to true for a target move, then this move
// can only target moves that are not hidden

export const BankMove = createBasicUtilityMove({
	id: 'move_bank_move',
	name: 'Bank Move',
	description: 'Bank 1 visible move and this move.',
	element: 'stone',
	targetType: {
		type: 'move',
		range: [1, 1],
	},
	operations: [
		operation(bankMoves),
		operation(bankMoves, {
			targets: selfMoveTargets(),
		}),
	],
});
