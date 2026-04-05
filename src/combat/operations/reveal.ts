// src/combat/operations/reveal.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from './types.ts';

export function revealMoves(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.moves) {
		if (target.isHidden === false) {
			continue;
		}
		intents.push({
			host: target,
			field: ['isHidden'],
			before: true,
			after: false,
			signal: `move.revealed.${target.id}`,
		});
	}

	return intents;
}

export function revealBlessings(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.blessings) {
		if (target.isHidden === false) {
			continue;
		}
		intents.push({
			host: target,
			field: ['isHidden'],
			before: true,
			after: false,
			signal: `blessing.revealed.${target.id}`,
		});
	}

	return intents;
}
