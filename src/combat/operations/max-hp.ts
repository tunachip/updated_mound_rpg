// src/combat/operations/max-hp.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyMaxHp (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyMaxHp', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.maxHp;
		intents.push({
			host: target,
			field: ['maxHp'],
			before: before,
			after: before + amount,
		});
	}
	return intents;
}

export function reduceMaxHp (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('reduceMaxHp', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.maxHp;
		const after = before - amount;
		intents.push({
			host: target,
			field: ['maxHp'],
			before: before,
			after: after,
		});
		if (target.hp > after) {
			intents.push({
				host: target,
				field: ['hp'],
				before: target.hp,
				after: after,
			});
		}
	}
	return intents;
}
