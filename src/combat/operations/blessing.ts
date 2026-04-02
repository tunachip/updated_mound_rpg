// src/combat/operations/blessing.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function exhaustBlessings(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.blessings) {
		if (target.isExhausted === false) {
			intents.push({
				host: target,
				field: ['isExhausted'],
				before: false,
				after: true,
			});
		}
	}
	return intents;
}

export function refreshBlessings(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.blessings) {
		if (target.isExhausted === true) {
			intents.push({
				host: target,
				field: ['isExhausted'],
				before: true,
				after: false,
			});
		}
	}
	return intents;
}
