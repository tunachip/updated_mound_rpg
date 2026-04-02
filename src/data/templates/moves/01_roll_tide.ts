// src/data/templates/moves/01_roll_tide.ts

import {
	applyAttunement,
	attack,
	operation,
	selfTargets,
} from '../../../combat/operations';
import type { MoveTemplate } from './types.ts';

export const RollTide: MoveTemplate = {
	id: 'move_roll_tide',
	name: 'Roll Tide',
	description: 'Caster attunes to Water. Deals 2 Water damage to target.',
	type: 'attack',
	element: 'water',
	targeting: {
		type: 'enemy',
		range: [1, 1],
	},
	baseDamage: 2,
	baseIterations: 1,
	cooldownTurns: 0,
	isBound: false,
	operations: [
		operation(applyAttunement, {
			ctx: { element: 'water' },
			targets: selfTargets(),
		}),
		operation(attack, {
			ctx: {
				element: 'water',
				amount: 2,
			},
		}),
	],
};
