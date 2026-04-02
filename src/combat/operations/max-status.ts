// src/combat/operations/max-status.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyStatusMaxTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyStatusMaxTurns', ctx, ['status', 'amount']);
	const { status, amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.statusMaxTurns[status];
		intents.push({
			host: target,
			field: ['statusMaxTurns', status],
			before: before,
			after: before + amount,
		});
	}
	return intents;
}

export function reduceStatusMaxTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('reduceStatusMaxTurns', ctx, ['status', 'amount']);
	const { status, amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.statusMaxTurns[status];
		const after = Math.max(0, before - amount);
		if (before > after) {
			intents.push({
				host: target,
				field: ['statusMaxTurns', status],
				before: before,
				after: after,
			});
		}
	}
	return intents;
}
