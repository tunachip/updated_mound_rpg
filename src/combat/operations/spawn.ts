// src/combat/operations/spawn.ts

import type { StateChange } from './diff.ts';
import type { CapturedEntityBoundary, OperationContext } from '.';
import { requireCtx } from './helpers.ts';
import type { EntityTemplate } from '../../data/templates';
import type { CombatEntity } from '../models';
import { buildCombatEntities } from '../models/constructor.ts';

type EntityTeam = NonNullable<OperationContext['entityTeam']>;

function clampIndex(
	index: number,
	length: number,
): number {
	return Math.max(0, Math.min(length, index));
}

function findAnchorEntity(
	ctx: OperationContext,
	entityTeam: EntityTeam,
): CombatEntity | null {
	const team = ctx.combat.entities[entityTeam];
	const targetedAnchor = ctx.targets.entities.find((entity) =>
		team.some((member) => member.id === entity.id),
	);
	if (targetedAnchor) {
		return targetedAnchor;
	}
	const changedHost = ctx.change?.host;
	if (changedHost && 'entityType' in changedHost) {
		const teamAnchor = team.find(
			(entity) => entity.id === changedHost.id);
		if (teamAnchor) {
			return teamAnchor;
		}
	}
	return null;
}

function boundaryIndex(
	boundary: CapturedEntityBoundary,
): number {
	if (boundary.leftId === null) {
		return 0;
	}
	if (boundary.rightId === null) {
		return boundary.originalOrder.length;
	}
	const rightIndex = boundary.originalOrder.indexOf(boundary.rightId);
	if (rightIndex >= 0) {
		return rightIndex;
	}
	const leftIndex = boundary.originalOrder.indexOf(boundary.leftId);
	if (leftIndex >= 0) {
		return leftIndex + 1;
	}
	return boundary.originalOrder.length;
}

export function captureEntityBoundary(
	ctx: OperationContext,
): CapturedEntityBoundary | null {
	requireCtx('captureEntityBoundary', ctx, ['combat', 'entityTeam', 'relativeEntityIndex']);
	const { entityTeam, relativeEntityIndex } = ctx;
	const team = ctx.combat.entities[entityTeam];
	const anchor = findAnchorEntity(ctx, entityTeam);
	if (!anchor) {
		return null;
	}
	const anchorIndex = team.findIndex((entity) => entity.id === anchor.id);
	if (anchorIndex < 0) return null;

	const insertionIndex = clampIndex(
		anchorIndex + relativeEntityIndex,
		team.length
	);
	return {
		team: entityTeam,
		leftId: insertionIndex > 0
			? team[insertionIndex - 1].id
			: null,
		rightId: insertionIndex < team.length
			? team[insertionIndex].id
			: null,
		originalOrder: team.map((entity) => entity.id),
	};
}

function resolveCapturedBoundaryIndex(
	ctx: OperationContext,
	boundary: CapturedEntityBoundary,
): number {
	const team = ctx.combat.entities[boundary.team];
	const findCurrentIndex = (id: string | null): number =>
		id == null ? -1 : team.findIndex((entity) => entity.id === id);
	const leftIndex = findCurrentIndex(boundary.leftId);
	const rightIndex = findCurrentIndex(boundary.rightId);
	if (leftIndex >= 0 &&
		rightIndex >= 0 &&
		leftIndex < rightIndex
	) {
		return leftIndex + 1;
	}
	if (leftIndex >= 0) {
		return leftIndex + 1;
	}
	if (rightIndex >= 0) {
		return rightIndex;
	}
	const intendedBoundaryIndex = boundaryIndex(boundary);
	for (let i = intendedBoundaryIndex - 1; i >= 0; i -= 1) {
		const currentIndex = findCurrentIndex(boundary.originalOrder[i]);
		if (currentIndex >= 0) {
			return currentIndex + 1;
		}
	}
	for (let i = intendedBoundaryIndex; i < boundary.originalOrder.length; i += 1) {
		const currentIndex = findCurrentIndex(boundary.originalOrder[i]);
		if (currentIndex >= 0) {
			return currentIndex;
		}
	}
	return clampIndex(intendedBoundaryIndex, team.length);
}

function resolveInsertionIndex(
	ctx: OperationContext,
	entityTeam: EntityTeam,
): number {
	const team = ctx.combat.entities[entityTeam];
	if (ctx.capturedEntityBoundary &&
		ctx.capturedEntityBoundary.team === entityTeam
	) {
		return resolveCapturedBoundaryIndex(ctx, ctx.capturedEntityBoundary);
	}
	if (ctx.entityIndex != null) {
		return clampIndex(ctx.entityIndex, team.length);
	}
	if (ctx.relativeEntityIndex != null) {
		const capturedBoundary = captureEntityBoundary(ctx);
		if (capturedBoundary) {
			return resolveCapturedBoundaryIndex(ctx, capturedBoundary);
		}
	}
	return team.length;
}

export function spawnEntity(
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('spawnEntity', ctx, ['combat', 'template', 'amount', 'entityTeam']);
	const { template, amount, entityTeam } = ctx;

	const templates: Array<EntityTemplate> = [];
	for (let i = 0; i < amount; i += 1) {
		templates.push(template);
	}
	if (templates.length === 0) {
		return intents;
	}

	const insertionIndex = resolveInsertionIndex(ctx, entityTeam);
	const spawnedEntities = buildCombatEntities(templates);
	const before = ctx.combat.entities[entityTeam];
	const after = [
		...before.slice(0, insertionIndex),
		...spawnedEntities,
		...before.slice(insertionIndex),
	];
	intents.push({
		host: ctx.combat,
		field: ['entities', entityTeam],
		before: before,
		after: after,
	});
	return intents;
}

export function despawnEntity(
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('despawnEntity', ctx, ['combat']);

	for (const entityTeam of ['party', 'encounters'] as const) {
		const before = ctx.combat.entities[entityTeam];
		const after = before.filter(
			(entity) => !ctx.targets.entities.some(
				(target) => target.id === entity.id)
		);
		if (after.length === before.length) {
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
