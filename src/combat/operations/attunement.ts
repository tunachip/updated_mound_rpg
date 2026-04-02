// src/combat/operations/attunement.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyAttunement (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyAttunement', ctx, ['element']);
	const { element } = ctx;

	for (const target of ctx.targets.entities) {
		if (target.attunedTo[element] === false) {
			intents.push({
				host: target,
				field: ['attunedTo', element],
				before: false,
				after: true,
			});
		}
	}
	return intents;
}

export function negateAttunement (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('negateAttunement', ctx, ['element']);
	const { element } = ctx;

	for (const target of ctx.targets.entities) {
		if (target.attunedTo[element] === true) {
			intents.push({
				host: target,
				field: ['attunedTo', element],
				before: true,
				after: false,
			});
		}
	}
	return intents;
}
