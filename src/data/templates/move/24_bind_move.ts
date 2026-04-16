import { bindMoves, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const BindMove = createBasicUtilityMove({
	id: 'move_bind_move',
	name: 'Bind Move',
	description: 'Bind 1 known move.',
	element: 'force',
	targetType: {
		type: 'move',
		range: [1, 1],
	},
	operations: [
		operation(bindMoves),
	],
});
