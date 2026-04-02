// src/data/templates/blessings/02_unbreakable.ts

import {
	blessingTargets,
	changeAfterAtMost,
	changeHostIsOwner,
	exhaustBlessings,
	listener,
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
		listener({
			id: 'unbreakable_prevent_death',
			phase: 'interrupt',
			trigger: 'entity.hp',
			conditions: [
				changeHostIsOwner(),
				changeAfterAtMost(0),
			],
			handler: (ctx) => {
				ctx.change.after = 1;
				ctx.sideEffects.push(
					...exhaustBlessings({
						caster: ctx.owner,
						move: ctx.move,
						blessing: ctx.blessing,
						change: ctx.change,
						targets: blessingTargets(ctx.blessing),
					}),
				);
			},
		}),
	],
};
