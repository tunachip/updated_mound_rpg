// src/combat/operations/reanimate.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function reanimate (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('reanimate', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		if (!target.isDead) continue;
		intents.push({
			host: target,
			field: ['isDead'],
			before: true,
			after: false,
		});

		const before = target.hp;
		const after = Math.min(target.maxHp, before + amount);
		intents.push({
			host: target,
			field: ['hp'],
			before: before,
			after: after,
		});
	}
	return intents;
}
