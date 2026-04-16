import { negateCooldown, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const BankMove = createBasicUtilityMove({
	id: 'move_bank_move',
	name: 'Bank Move',
	description: 'Clear cooldown on 1 known move.',
	element: 'thunder',
	targetType: {
		type: 'move',
		range: [1, 1],
	},
	operations: [
		operation(negateCooldown),
	],
});
