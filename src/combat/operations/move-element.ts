// src/combat/operations/move-metadata.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from './index.ts';
import { requireCtx } from './helpers.ts';

export function changeMoveElement (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('changeMoveElement', ctx, ['element']);
	const { element } = ctx;
	
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
