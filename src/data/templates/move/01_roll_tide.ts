// src/data/templates/moves/01_roll_tide.ts

import {
	applyAttunement,
	attack,
	loop,
	operation,
	selfTargets,
} from '../../../combat/operations';
import type { MoveTemplate } from './types.ts';

export const RollTide: MoveTemplate = {
	id: 'move_roll_tide',
	name: 'Roll Tide',
	description: 'Caster attunes to Water. Deals 2 Water damage to target.',
	moveType: 'attack',
	element: 'water',
	targetType: {
		type: 'enemy',
		range: [1, 1],
	},
	baseDamage: 2,
	baseIterations: 1,
	ignoresStatuses: [],
	operations: [
		operation(applyAttunement, {
			ctx: { element: 'water' },
			targets: selfTargets(),
		}),
		operation(loop, {
			ctx: { element: 'water' },
		}),
	],
	loopOperations: [
		operation(attack, {
			ctx: {
				element: 'water',
				amount: 2,
			},
		}),
	]
};
