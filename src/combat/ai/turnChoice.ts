// src/combat/ai/turnChoice.ts

import type { Goal } from './types.ts';
import type { CombatEntity, CombatMove, TurnChoice } from '../models';
import type { CombatState } from '../types.ts';
import {
	applyEnergy,
	baseOperationContext,
	entityTargets,
	emptyTargets,
	makeTargets,
	mergeStateChanges,
	operation,
	previewOperations,
	selfTargets,
	type StateChange,
	type TargetMatrix,
} from '../operations/index.ts';
import { moveEntity } from '../operations/move-entity.ts';
import { turnChoiceDisqualified } from '../turn/turn-disqualifiers.ts';

interface ScoredChoice {
	choice: TurnChoice;
	score: number;
}

function sameField(
	left: Array<string>,
	right: Array<string>,
): boolean {
	return left.length === right.length &&
		left.every((segment, index) => segment === right[index]);
}

function readPath(
	host: unknown,
	field: Array<string>,
): unknown {
	let current: unknown = host;
	for (const segment of field) {
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function projectedValue(
	goal: Goal,
	changes: Array<StateChange>,
): unknown {
	for (let i = changes.length - 1; i >= 0; i -= 1) {
		const change = changes[i];
		if (change.host !== goal.host) {
			continue;
		}
		if (sameField(change.field, goal.field)) {
			return change.after;
		}
	}
	return readPath(goal.host, goal.field);
}

function valueDistance(
	value: unknown,
	target: unknown,
): number {
	if (typeof value === 'number' && typeof target === 'number') {
		return Math.abs(value - target);
	}
	if (typeof value === 'boolean' && typeof target === 'boolean') {
		return value === target ? 0 : 1;
	}
	return Object.is(value, target) ? 0 : 1;
}

function scoreGoal(
	goal: Goal,
	changes: Array<StateChange>,
): number {
	const before = readPath(goal.host, goal.field);
	const after = projectedValue(goal, changes);
	const beforeDistance = valueDistance(before, goal.value);
	const afterDistance = valueDistance(after, goal.value);

	switch (goal.kind) {
		case 'approach':
		case 'maintain':
			return (beforeDistance - afterDistance) * goal.weight;
		case 'prevent':
			return (afterDistance - beforeDistance) * goal.weight;
	}
}

function teamOfEntity(
	combat: CombatState,
	entity: CombatEntity,
): 'party' | 'encounters' | null {
	if (combat.entities.party.some((member) => member.id === entity.id)) {
		return 'party';
	}
	if (combat.entities.encounters.some((member) => member.id === entity.id)) {
		return 'encounters';
	}
	return null;
}

function alliesOf(
	combat: CombatState,
	entity: CombatEntity,
): Array<CombatEntity> {
	const team = teamOfEntity(combat, entity);
	if (!team) {
		return [];
	}
	return combat.entities[team].filter((candidate) => !candidate.isDead);
}

function enemiesOf(
	combat: CombatState,
	entity: CombatEntity,
): Array<CombatEntity> {
	const team = teamOfEntity(combat, entity);
	if (!team) {
		return [];
	}
	const enemyTeam = team === 'party'
		? 'encounters'
		: 'party';
	return combat.entities[enemyTeam].filter((candidate) => !candidate.isDead);
}

function focusChoice(
	entity: CombatEntity,
): TurnChoice {
	return {
		move: {
			id: `focus:${entity.id}`,
			name: 'Focus',
			description: 'Skip turn and gain 1 energy.',
			element: 'neutral',
			moveType: 'focus',
			owner: entity,
			targetType: {
				type: 'self',
				range: [0, 0],
			},
			baseDamage: 0,
			baseIterations: 1,
			cooldownTurns: 0,
			isBound: false,
			canBeChainedInto: false,
			ignoresStatuses: ['sleep', 'anger', 'stun'],
			operations: [
				operation(applyEnergy, {
					ctx: { amount: 1 },
					targets: selfTargets(),
				}),
			],
			loopOperations: [],
		},
		targets: entityTargets(entity),
		isFocus: true,
	};
}

function movementChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<TurnChoice> {
	const team = teamOfEntity(combat, entity);
	if (!team) {
		return [];
	}

	const teamEntities = combat.entities[team];
	const currentIndex = teamEntities.findIndex((member) => member.id === entity.id);
	if (currentIndex < 0) {
		return [];
	}

	const choices: Array<TurnChoice> = [];
	for (let index = 0; index < teamEntities.length; index += 1) {
		if (index === currentIndex) {
			continue;
		}
		choices.push({
			move: {
				id: `move:${entity.id}:${index}`,
				name: 'Reposition',
				description: 'Move to a new position in the team order.',
				element: 'neutral',
				moveType: 'focus',
				owner: entity,
				targetType: {
					type: 'self',
					range: [0, 0],
				},
				baseDamage: 0,
				baseIterations: 1,
				cooldownTurns: 0,
				isBound: false,
				canBeChainedInto: false,
				ignoresStatuses: [],
				operations: [
					operation(moveEntity, {
						ctx: { entityIndex: index },
						targets: selfTargets(),
					}),
				],
				loopOperations: [],
			},
			targets: entityTargets(entity),
		});
	}
	return choices;
}

function combinations<T>(
	items: Array<T>,
	size: number,
): Array<Array<T>> {
	if (size === 0) {
		return [[]];
	}
	if (size > items.length) {
		return [];
	}
	if (size === 1) {
		return items.map((item) => [item]);
	}

	const result: Array<Array<T>> = [];
	for (let index = 0; index <= items.length - size; index += 1) {
		const head = items[index];
		for (const tail of combinations(items.slice(index + 1), size - 1)) {
			result.push([head, ...tail]);
		}
	}
	return result;
}

function targetMatricesForMove(
	combat: CombatState,
	caster: CombatEntity,
	move: CombatMove,
): Array<TargetMatrix> {
	const [minTargets, maxTargets] = move.targetType.range;
	const maxCount = Math.max(minTargets, maxTargets);

	switch (move.targetType.type) {
		case 'self':
			return [entityTargets(caster)];
		case 'ally': {
			const allies = alliesOf(combat, caster).filter((ally) => ally.id !== caster.id);
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, allies.length); count += 1) {
				for (const combo of combinations(allies, count)) {
					matrices.push(makeTargets({ entities: combo }));
				}
			}
			return matrices;
		}
		case 'enemy': {
			const enemies = enemiesOf(combat, caster);
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, enemies.length); count += 1) {
				for (const combo of combinations(enemies, count)) {
					matrices.push(makeTargets({ entities: combo }));
				}
			}
			return matrices;
		}
		case 'entity': {
			const allEntities = [...alliesOf(combat, caster), ...enemiesOf(combat, caster)];
			const unique = allEntities.filter(
				(entity, index, array) =>
					array.findIndex((candidate) => candidate.id === entity.id) === index,
			);
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, unique.length); count += 1) {
				for (const combo of combinations(unique, count)) {
					matrices.push(makeTargets({ entities: combo }));
				}
			}
			return matrices;
		}
		case 'move':
		case 'blessing':
			if (minTargets === 0) {
				return [emptyTargets()];
			}
			return [];
	}
}

function previewChoiceChanges(
	combat: CombatState,
	entity: CombatEntity,
	choice: TurnChoice,
): Array<StateChange> {
	const previewSequence = previewOperations(
		choice.move.operations,
		baseOperationContext(
			combat,
			entity,
			choice.move,
			choice.targets,
		),
	);
	return mergeStateChanges(
		previewSequence[previewSequence.length - 1] ?? [],
	);
}

function scoreChoice(
	combat: CombatState,
	entity: CombatEntity,
	choice: TurnChoice,
): number {
	const projectedChanges = previewChoiceChanges(combat, entity, choice);
	let score = entity.goals.reduce(
		(total, goal) => total + scoreGoal(goal, projectedChanges),
		0,
	);

	if (choice.isFocus) {
		score -= 0.05;
	}

	if (choice.move.id.startsWith('move:')) {
		score -= entity.aiTuning.positioning;
	}

	return score;
}

function moveChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<TurnChoice> {
	const choices: Array<TurnChoice> = [];

	for (const move of entity.moves) {
		if (move.cooldownTurns > 0) {
			continue;
		}

		const targetOptions = targetMatricesForMove(combat, entity, move);
		for (const targets of targetOptions) {
			const choice: TurnChoice = { move, targets };
			if (turnChoiceDisqualified(entity, choice)) {
				continue;
			}
			choices.push(choice);
		}
	}

	return choices;
}

export function calculateTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<TurnChoice> {
	const choices = [
		...moveChoices(combat, entity),
		...movementChoices(combat, entity),
		focusChoice(entity),
	].filter((choice) => !turnChoiceDisqualified(entity, choice));

	const ranked: Array<ScoredChoice> = choices.map((choice) => ({
		choice,
		score: scoreChoice(combat, entity, choice),
	}));

	ranked.sort((left, right) => right.score - left.score);
	return ranked.map(({ choice }) => choice);
}
