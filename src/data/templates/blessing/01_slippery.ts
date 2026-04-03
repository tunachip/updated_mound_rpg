// src/data/templates/blessing/01_slippery.ts

import {
	attemptDodge,
	applyCooldownTurns,
	cancelPendingChange,
	changeHostIsOwner,
	ifThenElse,
	listener,
	operation,
	ownerTargets,
	selfBlessingTargets,
} from '../../../combat/operations/index.ts';
import type { BlessingTemplate } from './types.ts';

export const Slippery: BlessingTemplate = {
	id: 'blessing_slippery',
	name: 'Slippery',
	description: 'When owner is Attacked, 50% chance of dodge. [Cooldown 3]',
	element: 'water',
	isBound: false,
	listeners: [
		listener({
			id: 'slippery_chance_dodge',
			phase: 'interrupt',
			trigger: 'entity.hp',
			conditions: [
				changeHostIsOwner(),
				(ctx) =>
					typeof ctx.change.before === 'number' &&
					typeof ctx.change.after === 'number' &&
					ctx.change.after < ctx.change.before &&
					ctx.move?.moveType === 'attack',
			],
			operations: [
				operation(attemptDodge, {
					ctx: { amount: 5 },
					targets: ownerTargets(),
				}),
				operation(ifThenElse, {
					ctx: {
						signal: 'entity.dodges',
						operations: [
							operation(cancelPendingChange),
							operation(applyCooldownTurns, {
								ctx: { amount: 3 },
								targets: selfBlessingTargets(),
							}),
						],
					},
				}),
			],
		}),
	],
};
