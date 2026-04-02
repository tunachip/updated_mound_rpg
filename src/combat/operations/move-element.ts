// src/combat/operations/move-metadata.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from './index.ts';

export function changeMoveElement (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const element = ctx.element;
	if (!element) throw new Error("Required Field 'Element' Not Provided in CTX.");
	
	for (const target of ctx.targets.moves) {
		const before = target.element;
		intents.push({
			host: target,
			field: ['maxHp'],
			before: before,
			after: element,
		});
	}
	return intents;
}
