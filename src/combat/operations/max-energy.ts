// src/combat/operations/energy.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyMaxEnergy (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyMaxEnergy', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.maxEnergy;
		intents.push({
			host: target,
			field: ['maxEnergy'],
			before: before,
			after: before + amount,
		});
	}
	return intents;
}

export function reduceMaxEnergy (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('reduceMaxEnergy', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.maxEnergy;
		if (before > 0) {
			intents.push({
				host: target,
				field: ['maxEnergy'],
				before: before,
				after: Math.max(0, before - amount),
			});
		}
	}
	return intents;
}
