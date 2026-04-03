// src/combat/operations/dodge.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx, randomNumber } from './helpers.ts';

export function attemptDodge (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('attemptDodge', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		if (randomNumber(0, 10) < amount) {
			intents.push({
				host: target,
				field: ['dodges'],
				before: target.dodges,
				after: target.dodges + 1,
			});
		}
	}
	return intents;
}
