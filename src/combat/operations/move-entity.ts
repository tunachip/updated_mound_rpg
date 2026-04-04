// src/combat/operations/move-entity.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

function clampIndex(
	index: number,
	length: number,
): number {
	return Math.max(0, Math.min(length, index));
}

export function moveEntity(
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('moveEntity', ctx, ['combat', 'entityIndex']);
	const { entityIndex } = ctx;

	const targetIds = new Set(
		ctx.targets.entities.map((entity) => entity.id)
	);
	if (targetIds.size === 0) {
		return intents;
	}

	for (const entityTeam of ['party', 'encounters'] as const) {
		const before = ctx.combat.entities[entityTeam];
		const moving = before.filter(
			(entity) => targetIds.has(entity.id)
		);
		if (moving.length === 0) {
			continue;
		}

		const remaining = before.filter((entity) => !targetIds.has(entity.id));
		const insertionIndex = clampIndex(entityIndex, remaining.length);
		const after = [
			...remaining.slice(0, insertionIndex),
			...moving,
			...remaining.slice(insertionIndex),
		];

		const unchanged = after.every(
			(entity, index) => entity.id === before[index]?.id);
		if (unchanged) {
			continue;
		}

		intents.push({
			host: ctx.combat,
			field: ['entities', entityTeam],
			before,
			after,
		});
	}

	return intents;
}
