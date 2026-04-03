// src/combat/operations/curse-attempt.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { randomNumber } from './helpers.ts';
import { applyStatusTurns } from './status.ts';

export function attemptCurse (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.entities) {
		const before = target.curseChance;
		if (before >= randomNumber(1, 10)) {
			const statusIntents = applyStatusTurns({
				combat: ctx.combat,
				caster: ctx.caster,
				move: ctx.move,
				blessing: ctx.blessing,
				status: 'curse',
				amount: 1,
				targets: {
					entities: [target],
					moves: [],
					blessings: []
				},
			})
			for (const intent of statusIntents) {
				intents.push(intent);
			}
		}
	}
	return intents;
}
