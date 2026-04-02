// src/data/templates/moves/01_roll_tide.ts

import { caster, constant, selectedEntity } from '../../../combat/operations';
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
		{
			kind: 'emit_intent',
			intent: {
				kind: 'set_attunement',
				target: caster(),
				element: 'water',
				value: true,
			},
		},
		{
			kind: 'repeat',
			times: constant(1),
			steps: [{
					kind: 'emit_intent',
					intent: {
						kind: 'deal_damage',
						target: selectedEntity(0),
						element: 'water',
						amount: constant(2),
					},
			}],
		},
	],
};
