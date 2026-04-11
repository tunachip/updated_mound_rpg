// src/combat/ai/goals.ts

import type { Goal, GoalHierarchy, GoalKind, AiTuning } from './types.ts';
import type { CombatEntity } from '../models';
import type { CombatState } from '../types.ts';
import type { Status } from '../../shared';

const SELF_STATUS_GOALS = [
	'burn',
	'decay',
	'wound',
	'curse',
	'stun',
	'anger',
	'sleep',
	'sick',
] as const satisfies Array<Status>;

export const defaultAiTuning: AiTuning = {
	aggression: 10,
	selfPreservation: 12,
	allyPreservation: 4,
	statusAversion: 3,
	energyValue: 1,
	positioning: 0.25,
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
	value: any,
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
	value: any,
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
	value: any,
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

export function maintainValue(
	entity: CombatEntity,
	field: Array<string>,
	weight: number,
): Goal {
	let value: any = entity;
	for (const segment of field) {
		value = value[segment];
	}
	return createGoal(
		'maintain',
		entity,
		field,
		value,
		weight,
		`maintain '${entity.name}' ${field.join('.')} == ${String(value)}`,
	);
}

export function preserveSelf(
	entity: CombatEntity,
	weight: number,
): Goal {
	return approachValue(entity, ['hp'], entity.maxHp, weight);
}

export function valueEnergy(
	entity: CombatEntity,
	weight: number,
): Goal {
	return approachValue(entity, ['energy'], entity.maxEnergy, weight);
}

export function preventStatus(
	entity: CombatEntity,
	status: Status,
	weight: number,
): Goal {
	return preventValue(entity, ['statusTurns', status], 0, weight);
}

export function buildDefaultGoalHierarchy(
	self: CombatEntity,
	allies: Array<CombatEntity>,
	enemies: Array<CombatEntity>,
	tuning: AiTuning = defaultAiTuning,
): GoalHierarchy {
	return [
		preventDeath(self, tuning.selfPreservation + 3),
		preserveSelf(self, tuning.selfPreservation),
		valueEnergy(self, tuning.energyValue),
		...SELF_STATUS_GOALS.map((status) =>
			preventStatus(self, status, tuning.statusAversion),
		),
		...allies
			.filter((ally) => ally.id !== self.id)
			.flatMap((ally) => [
				preventDeath(ally, tuning.allyPreservation),
				approachValue(ally, ['hp'], ally.maxHp, Math.max(0, tuning.allyPreservation - 1)),
			]),
		...enemies.map((enemy) =>
			killEnemy(enemy, tuning.aggression),
		),
	];
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
