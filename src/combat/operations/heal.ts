// src/combat/operations/heal.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function heal (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('heal', ctx, ['amount']);
	const { amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		if (target.isDead) continue;
		const before = target.hp;
		const after = Math.min(target.maxHp, before + amount);
		intents.push({
			host: target,
			field: ['maxHp'],
			before: before,
			after: after,
		});
	}
	return intents;
}

export function fullHeal (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	
	for (const target of ctx.targets.entities) {
		if (target.isDead) continue;
		intents.push({
			host: target,
			field: ['maxHp'],
			before: target.hp,
			after: target.maxHp,
		});
	}
	return intents;
}
