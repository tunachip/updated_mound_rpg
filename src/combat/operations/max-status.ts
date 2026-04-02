// src/combat/operations/max-status.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function applyStatusMaxTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const status = ctx.status;
	const amount = ctx.amount;
	if (!status) throw new Error("Required Field 'Status' Not Provided in CTX.");
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
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
	const status = ctx.status;
	const amount = ctx.amount;
	if (!status) throw new Error("Required Field 'Status' Not Provided in CTX.");
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
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
