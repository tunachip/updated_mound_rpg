// src/data/templates/blessings/03_geothermal.ts

import {
	applyShields,
	listener,
	operation,
	ownerTargets,
} from '../../../combat/operations/index.ts';
import type { BlessingTemplate } from './types.ts';

export const Geothermal: BlessingTemplate = {
	id: 'blessing_geothermal',
	name: 'Geothermal',
	description: 'When owner gains Burn, owner gains 1 Shield.',
	element: 'fire',
	isBound: false,
	listeners: [
		listener({
			id: 'geothermal_gain_shield',
			phase: 'sideEffect',
			trigger: 'entity.hasStatus.burn',
			operations: [
				operation(applyShields, {
					ctx: { amount: 1 },
					targets: ownerTargets(),
				}),
			],
		}),
	],
};
