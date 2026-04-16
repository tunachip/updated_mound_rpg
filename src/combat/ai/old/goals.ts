// src/combat/ai/goals.ts

import type { Status, TargetType } from '../../shared';
import type { CombatEntity } from '../models';
import type { CombatState } from '../types.ts';
import type { Operation } from '../operations/index.ts';
import type { Goal, GoalHierarchy, GoalKind, AiTuning } from './types.ts';

const HARMFUL_STATUSES = [
	'burn',
	'decay',
	'wound',
	'curse',
	'stun',
	'anger',
	'sleep',
	'sick',
] as const satisfies Array<Status>;

const BENEFICIAL_STATUSES = [
	'regen',
	'focus',
	'strong',
	'tough',
	'slick',
	'barbs',
] as const satisfies Array<Status>;

interface EntityAiCapabilities {
	canHealAllies: boolean;
	harmfulStatuses: Set<Status>;
	beneficialStatuses: Set<Status>;
	cleansedStatuses: Set<Status>;
}

export const defaultAiTuning: AiTuning = {
	roles: {
		killEnemies: true,
		avoidDeath: true,
		healAllies: false,
		supportAllies: false,
		applyStatuses: false,
		cleanseStatuses: false,
		manipulateAttunements: false,
		manipulateMoves: false,
	},
	aggression: 10,
	selfPreservation: 12,
	allyPreservation: 4,
	statusAversion: 3,
	energyValue: 1,
	positioning: 0.25,
	foresight: null,
	goalWidth: 4,
	goalWeightRolloff: 0.85,
};

function goalId(
	kind: GoalKind,
	entity: CombatEntity,
	field: Array<string>,
	value: unknown,
): string {
	return [
		kind,
		entity.id,
		field.join('.'),
		String(value),
	].join(':');
}

function createGoal(
	kind: GoalKind,
	entity: CombatEntity,
	field: Array<string>,
	value: unknown,
	weight: number,
	name: string,
): Goal {
	return {
		id: goalId(kind, entity, field, value),
		name,
		kind,
		host: entity,
		field,
		value,
		weight,
	};
}

export function killEnemy(
	entity: CombatEntity,
	weight: number = 10,
): Goal {
	return approachValue(entity, ['hp'], 0, weight);
}

export function preventDeath(
	entity: CombatEntity,
	weight: number = 11,
): Goal {
	return preventValue(entity, ['hp'], 0, weight);
}

export function approachValue(
	entity: CombatEntity,
	field: Array<string>,
	value: unknown,
	weight: number,
): Goal {
	return createGoal(
		'approach',
		entity,
		field,
		value,
		weight,
		`approach '${entity.name}' ${field.join('.')} -> ${String(value)}`,
	);
}

export function preventValue(
	entity: CombatEntity,
	field: Array<string>,
	value: unknown,
	weight: number,
): Goal {
	return createGoal(
		'prevent',
		entity,
		field,
		value,
		weight,
		`prevent '${entity.name}' ${field.join('.')} -> ${String(value)}`,
	);
}

function nestedOperations(
	operation: Operation,
): Array<Operation> {
	return [
		...(operation.ctx?.operations ?? []),
		...(operation.ctx?.elseOperations ?? []),
		...(operation.ctx?.listeners ?? []).flatMap(
			(listener) => listener.operations,
		),
	];
}

function addStatus(
	target: Set<Status>,
	status: Status | undefined,
): void {
	if (status) {
		target.add(status);
	}
}

function targetAllowsSupport(
	targetType: TargetType,
): boolean {
	return targetType === 'self' ||
		targetType === 'ally' ||
		targetType === 'friend' ||
		targetType === 'entity';
}

function targetAllowsOffense(
	targetType: TargetType,
): boolean {
	return targetType === 'enemy' ||
		targetType === 'entity';
}

function scanOperationTree(
	operation: Operation,
	targetType: TargetType,
	capabilities: EntityAiCapabilities,
): void {
	const status = operation.ctx?.status;

	switch (operation.name) {
		case 'heal':
			if (targetAllowsSupport(targetType)) {
				capabilities.canHealAllies = true;
			}
			break;
		case 'applyStatusTurns':
		case 'extendStatusTurns':
			if (status && BENEFICIAL_STATUSES.includes(status) && targetAllowsSupport(targetType)) {
				capabilities.beneficialStatuses.add(status);
			}
			if (status && HARMFUL_STATUSES.includes(status) && targetAllowsOffense(targetType)) {
				capabilities.harmfulStatuses.add(status);
			}
			break;
		case 'negateStatus':
		case 'reduceStatusTurns':
			if (targetAllowsSupport(targetType)) {
				addStatus(capabilities.cleansedStatuses, status);
			}
			break;
	}

	for (const child of nestedOperations(operation)) {
		scanOperationTree(child, targetType, capabilities);
	}
}

function collectEntityAiCapabilities(
	entity: CombatEntity,
): EntityAiCapabilities {
	const capabilities: EntityAiCapabilities = {
		canHealAllies: false,
		harmfulStatuses: new Set(),
		beneficialStatuses: new Set(),
		cleansedStatuses: new Set(),
	};

	for (const move of entity.moves) {
		for (const operation of [...move.operations, ...move.loopOperations]) {
			scanOperationTree(operation, move.targetType.type, capabilities);
		}
	}

	return capabilities;
}

function uniqueEntities(
	entities: Array<CombatEntity>,
): Array<CombatEntity> {
	return entities.filter(
		(entity, index, array) =>
			array.findIndex((candidate) => candidate.id === entity.id) === index,
	);
}

export function buildDefaultGoalHierarchy(
	self: CombatEntity,
	allies: Array<CombatEntity>,
	enemies: Array<CombatEntity>,
	tuning: AiTuning = defaultAiTuning,
): GoalHierarchy {
	const roles = {
		...defaultAiTuning.roles,
		...tuning.roles,
	};
	const capabilities = collectEntityAiCapabilities(self);
	const goals: GoalHierarchy = [];

	if (roles.avoidDeath) {
		goals.push(preventDeath(self, tuning.selfPreservation + 3));
	}

	if (roles.killEnemies) {
		goals.push(
			...enemies.map((enemy) => killEnemy(enemy, tuning.aggression)),
		);
	}

	if (roles.healAllies && capabilities.canHealAllies) {
		goals.push(
			...allies
				.filter((ally) => ally.id !== self.id)
				.map((ally) => preventDeath(ally, tuning.allyPreservation)),
		);
	}

	if (roles.cleanseStatuses) {
		goals.push(
			...HARMFUL_STATUSES
				.filter((status) => capabilities.cleansedStatuses.has(status))
				.map((status) =>
					preventValue(self, ['statusTurns', status], 0, tuning.statusAversion),
				),
		);
	}

	if (roles.applyStatuses) {
		for (const status of capabilities.harmfulStatuses) {
			for (const enemy of enemies) {
				goals.push(
					approachValue(
						enemy,
						['statusTurns', status],
						1,
						Math.max(1, tuning.aggression - 2),
					),
				);
			}
		}
	}

	if (roles.supportAllies) {
		for (const status of capabilities.beneficialStatuses) {
			for (const ally of uniqueEntities([self, ...allies])) {
				goals.push(
					approachValue(
						ally,
						['statusTurns', status],
						1,
						Math.max(1, tuning.allyPreservation),
					),
				);
			}
		}
	}

	return goals;
}

export function mergeDefaultGoals(
	existing: GoalHierarchy,
	defaults: GoalHierarchy,
): GoalHierarchy {
	const merged = new Map(
		existing.map((goal) => [goal.id, goal] as const),
	);
	for (const goal of defaults) {
		if (!merged.has(goal.id)) {
			merged.set(goal.id, goal);
		}
	}
	return [...merged.values()];
}

export function hydrateCombatGoals(
	combat: CombatState,
): void {
	const entities = [...combat.entities.party, ...combat.entities.encounters];
	for (const entity of entities) {
		const allies = combat.entities.party.includes(entity)
			? combat.entities.party
			: combat.entities.encounters;
		const enemies = combat.entities.party.includes(entity)
			? combat.entities.encounters
			: combat.entities.party;

		entity.goals = mergeDefaultGoals(
			entity.goals,
			buildDefaultGoalHierarchy(entity, allies, enemies, entity.aiTuning),
		);
	}
}
