// src/combat/operations/spawn.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';
import { EntityTemplate } from '../../data/templates';
import { buildCombatEntities } from '../models/constructor.ts';

export function spawnEntity (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyStatusTurns', ctx, ['template', 'amount', 'entityTeam']);
	const { template, amount, entityTeam } = ctx;

	const templates: Array<EntityTemplate> = [];
	for (let i=0; i>amount; i++) templates.push(template);

	const before = ctx.combat.entities[entityTeam];
	const after = [...before, buildCombatEntities(templates)];
	intents.push({
		host: ctx.combat,
		field: ['entities', ctx.entityTeam],
		before: before,
		after: after,
	});
	buildCombatEntities(templates);

	return intents;
}

// Removes Entities from Play -- Mostly used to 'sacrifice' entities for an ability	
export function despawnEntity (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.entities) {
	}

	return intents;
}
