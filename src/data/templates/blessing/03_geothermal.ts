// src/data/templates/blessings/03_geothermal.ts

import {
	applyShields,
	entityTargets,
	listener,
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
		listener({
			id: 'geothermal_gain_shield',
			phase: 'sideEffect',
			trigger: 'entity.hasStatus.burn',
			handler: (ctx) => {
				ctx.sideEffects.push(
					...applyShields({
						caster: ctx.owner,
						move: ctx.move,
						blessing: ctx.blessing,
						change: ctx.change,
						targets: entityTargets(ctx.owner),
						amount: 1,
					}),
				);
			},
		}),
	],
};
