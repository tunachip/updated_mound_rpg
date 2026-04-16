import {
	bindMoves,
	operation,
	selfMoveTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: binds this move after binding the target

export const BindMove = createBasicUtilityMove({
	id: 'move_bind_move',
	name: 'Bind Move',
	description: 'Bind 1 known move.',
	element: 'plant',
	targetType: {
		type: 'move',
		range: [1, 1],
	},
	operations: [
		operation(bindMoves),
		operation(bindMoves, {
			targets: selfMoveTargets(),
		}),
	],
});
