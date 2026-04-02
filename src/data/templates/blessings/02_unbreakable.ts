// src/data/templates/blessings/02_unbreakable.ts

import {
	constant,
	eventTargetIsOwner,
	selfBlessing,
	wouldReduceTargetHpToOrBelow,
} from '../../../combat/operations';
import type { BlessingTemplate } from './types.ts';

export const Unbreakable: BlessingTemplate = {
	id: 'blessing_unbreakable',
	name: 'Unbreakable',
	description:
		'When owner would die, instead set their HP to 1 and exhaust this blessing.',
	element: 'stone',
	cooldownTurns: 0,
	isBound: false,
	listeners: [
		{
			id: 'unbreakable_prevent_death',
			phase: 'interrupt',
			trigger: 'deal_damage',
			conditions: [
				eventTargetIsOwner(),
				wouldReduceTargetHpToOrBelow(0),
			],
			effects: [
				{
					kind: 'set_current_intent_target_hp',
					hp: constant(1),
				},
				{
					kind: 'enqueue_side_effect',
					intent: {
						kind: 'set_blessing_exhausted',
						target: selfBlessing(),
						isExhausted: true,
					},
				},
			],
		},
	],
};
