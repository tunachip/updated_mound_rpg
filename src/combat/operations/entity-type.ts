// src/combat/operations/entity-type.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function changeEntityType (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const entityType = ctx.entityType;
	if (!entityType) throw new Error("Required Field 'EntityType' Not Provided in CTX.");
	
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
