// src/combat/operations/iteration.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function applyExtraIterations (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
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
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
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


