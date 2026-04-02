// src/combat/operations/attunement.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function applyAttunement (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const element = ctx.element;
	if (!element) throw new Error("Required Field 'Element' Not Provided in CTX.");

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
	const element = ctx.element;
	if (!element) throw new Error("Required Field 'Element' Not Provided in CTX.");

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
