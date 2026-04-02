// src/combat/operations/entity-type.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function changeEntityType (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('changeEntityType', ctx, ['entityType']);
	const { entityType } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.entityType;
		if (before !== entityType) {
			intents.push({
				host: target,
				field: ['entityType'],
				before: before,
				after: entityType,
			});
		}
	}
	return intents;
}
