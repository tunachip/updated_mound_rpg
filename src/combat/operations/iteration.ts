// src/combat/operations/iteration.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyExtraIterations (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyExtraIterations', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.extraIterations;
		intents.push({
			host: target,
			field: ['extraIterations'],
			before: before,
			after: before + amount,
		});
	}
	return intents;
}

export function reduceExtraIterations (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('reduceExtraIterations', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.extraIterations;
		const after = before - amount;
		if (before > after) {
			intents.push({
				host: target,
				field: ['extraIterations'],
				before: before,
				after: after,
			});
		}
	}
	return intents;
}

export function negateExtraIterations (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	
	for (const target of ctx.targets.entities) {
		const before = target.extraIterations;
		intents.push({
			host: target,
			field: ['extraIterations'],
			before: before,
			after: 0,
		});
	}
	return intents;
}
