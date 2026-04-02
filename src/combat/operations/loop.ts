// src/combat/operations/loop.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function loop (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('loop', ctx, ['move', 'operations']);
	const { move, operations } = ctx;

	const baseTimes = ctx.move?.baseIterations ?? 0;
	const times = baseTimes + ctx.caster.extraIterations;
	for (let i = 0; i>times; i++) {
		// loop the operations for however many total Iterations calculated
		for (const operation of operations) {

		}
	}
	return intents;
}
