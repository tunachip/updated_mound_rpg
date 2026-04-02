// src/combat/operations/shield.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyShields (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyShields', ctx, ['amount']);
	const { amount } = ctx;

	for (const target of ctx.targets.entities) {
		intents.push({
			host: target,
			field: ['shields'],
			before: target.shields,
			after: target.shields + amount,
		});
	}
	return intents;
}

export function reduceShields (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('reduceShields', ctx, ['amount']);
	const { amount } = ctx;

	for (const target of ctx.targets.entities) {
		intents.push({
			host: target,
			field: ['shields'],
			before: target.shields,
			after: Math.max(0, target.shields - amount),
		});
	}
	return intents;
}

export function extendShields (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('extendShields', ctx, ['amount']);
	const { amount } = ctx;

	for (const target of ctx.targets.entities) {
		const before = target.shields;
		if (before > 0) {
			intents.push({
				host: target,
				field: ['shields'],
				before: before,
				after: before + amount,
			});
		}
	}
	return intents;
}

export function negateShields (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.entities) {
		intents.push({
			host: target,
			field: ['shields'],
			before: target.shields,
			after: 0,
		});
	}
	return intents;
}
