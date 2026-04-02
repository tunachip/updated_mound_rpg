// src/data/templates/blessings/03_geothermal.ts

import {
	constant,
	eventStatusIs,
	eventTargetIsOwner,
} from '../../../combat/operations';
import type { BlessingTemplate } from './types.ts';

export const Geothermal: BlessingTemplate = {
	id: 'blessing_geothermal',
	name: 'Geothermal',
	description: 'When owner gains Burn, owner gains 1 Shield.',
	element: 'fire',
	cooldownTurns: 0,
	isBound: false,
	listeners: [
		{
			id: 'geothermal_gain_shield',
			phase: 'side_effect',
			trigger: 'apply_status',
			conditions: [
				eventTargetIsOwner(),
				eventStatusIs('burn'),
			],
			effects: [
				{
					kind: 'enqueue_side_effect',
					intent: {
						kind: 'gain_shield',
						target: { kind: 'listener_owner' },
						amount: constant(1),
					},
				},
			],
		},
	],
};
