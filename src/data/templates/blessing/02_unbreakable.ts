// src/data/templates/blessings/02_unbreakable.ts

import {
	changeAfterAtMost,
	changeHostIsOwner,
	exhaustBlessings,
	listener,
	operation,
	setPendingChangeAfter,
	selfBlessingTargets,
} from '../../../combat/operations/index.ts';
import type { BlessingTemplate } from './types.ts';

export const Unbreakable: BlessingTemplate = {
	id: 'blessing_unbreakable',
	name: 'Unbreakable',
	description:
		'When owner would die, instead set their HP to 1 and exhaust this blessing.',
	element: 'stone',
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
			operations: [
				operation(setPendingChangeAfter, {
					ctx: { amount: 1 },
				}),
				operation(exhaustBlessings, {
					targets: selfBlessingTargets(),
				}),
			],
		}),
	],
};
