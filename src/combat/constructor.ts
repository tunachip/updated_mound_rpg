// src/combat/constructor.ts

import {
  type Status,
  Statuses,
  DamageElements,
  createRecord,
  defaultStatusMaxTurns,
  ModifierExpression
} from '../shared';
import type {
  CombatState,
  EntityMatrix,
  CombatEntity,
  CombatMove,
  CombatBlessing
} from '.';
import type {
	Operation
} from './operations';
import type {
  FragmentTemplate,
  EntityTemplate,
  MoveTemplate,
  BlessingTemplate
} from '../data/templates';

export function buildCombatState (
	party: Array<EntityTemplate>,
	encounters: Array<EntityTemplate>,
): CombatState {
	const entities: EntityMatrix = {
		encounters: [],
		party: [],
	};
	for (const entityTemplate of encounters) {
		const entity = buildCombatEntity(entityTemplate);
		for (const moveTemplate of entityTemplate.moves) {
			entity.moves.push(buildCombatMove(
				moveTemplate[0],
				moveTemplate[1],
				entity));
		}
		for (const blessingTemplate of entityTemplate.blessings) {
			entity.blessings.push(buildCombatBlessing(
				blessingTemplate,
				entity));
		}
		entities.encounters.push(entity);
	}

	for (const entityTemplate of party) {
		const entity = buildCombatEntity(entityTemplate);
		for (const moveTemplate of entityTemplate.moves) {
			entity.moves.push(buildCombatMove(
				moveTemplate[0],
				moveTemplate[1],
				entity));
		}
		for (const blessingTemplate of entityTemplate.blessings) {
			entity.blessings.push(buildCombatBlessing(
				blessingTemplate,
				entity));
		}
		entities.encounters.push(entity);
	}

	return {
		turn: 0,
		entities: entities,
		listeners: [],
		eventLog: [],
	};
}

export function buildCombatEntity (
	entity: EntityTemplate,
): CombatEntity {
	return {
		id: entity.id,
		name: entity.name,
		entityType: entity.entityType,
		hp: entity.hp,
		maxHp: entity.maxHp,
		energy: entity.energy,
		maxEnergy: entity.maxEnergy,
		shields: 0,
		extraIterations: 0,
		isDead: false,
		shieldsBroken: false,
		curseChance: 0,
		attunedTo: createRecord(DamageElements, false),
		turnsAttuned: createRecord(DamageElements, 0),
		hasStatus: createRecord(Statuses, false),
		statusTurns: createRecord(Statuses, 0),
		statusMaxTurns: defaultStatusMaxTurns,
		ignoresStatusTurns: createRecord(Statuses, 0),
		maxDamageTaken: 0,
		lastDamageTaken: 0,
		totalDamageTaken: 0,
		moves: [],
		blessings: [],
		turnChoices: [],
	};
}

function resolveNumberModifier (
	base: number,
	expression: ModifierExpression,
	modifier: number,
): number {
	switch (expression) {
		case 'overwrittenBy':
			return base = modifier;
		case 'plus':
			return base += modifier;
		case 'minus':
			return base -= modifier;
		case 'times':
			return base = base * modifier;
		case 'dividedBy':
			return base = base / modifier;
		default:
			return base;
	}
}

function resolveStatusesModifier (
	base: Array<Status>,
	expression: ModifierExpression,
	modifier: Array<Status>,
): Array<Status> {
	switch (expression) {
		case 'overwrittenBy':
			return base = modifier;
		case 'merge':
			return [...base, ...modifier];
		default:
			return base;
	}
}

function resolveOperationModifier (
	base: Array<Operation>,
	baseLoop: Array<Operation>,
	expression: ModifierExpression,
	modifier: Operation,
): [Array<Operation>, Array<Operation>] {
	switch (expression) {
		case 'insertAtStart':
			return [[modifier, ...base], baseLoop];
		case 'insertAtEnd':
			return [[...base, modifier], baseLoop];
		case 'insertAtStartOfLoop':
			return [base, [modifier, ...baseLoop]];
		case 'insertAtEndOfLoop':
			return [base, [...baseLoop, modifier]];
		default:
			return [base, baseLoop];
	}
}

function resolveOperationsModifier (
	base: Array<Operation>,
	baseLoop: Array<Operation>,
	instructions: Array<[ModifierExpression, Operation]>,
): [Array<Operation>, Array<Operation>] {
	for (const instruction of instructions) {
		[base, baseLoop] = resolveOperationModifier(
			base,
			baseLoop,
			instruction[0],
			instruction[1],
		);
	}
	return [base, baseLoop];
}

export function buildCombatMove (
	moveTemplate: MoveTemplate,
	fragments: Array<FragmentTemplate>,
	owner: CombatEntity,
): CombatMove {
	const move = {
		id: moveTemplate.id,
		name: moveTemplate.name,
		description: moveTemplate.description,
		element: moveTemplate.element,
		moveType: moveTemplate.moveType,
		owner: owner,
		targetType: moveTemplate.targetType,
		baseDamage: moveTemplate.baseDamage,
		cooldownTurns: 0,
		isBound: false,
		baseIterations: moveTemplate.baseIterations,
		ignoresStatuses: moveTemplate.ignoresStatuses,
		operations: moveTemplate.operations,
		loopOperations: moveTemplate.loopOperations,
	};
	// Fragments Modify Move Initialization Values
	for (const fragment of fragments) {
		if (fragment.element) move.element = fragment.element;
		if (fragment.baseDamage) {
			move.baseDamage = resolveNumberModifier(
				move.baseDamage,
				fragment.baseDamage[0],
				fragment.baseDamage[1],
			);
		}
		if (fragment.baseIterations) {
			move.baseIterations = resolveNumberModifier(
				move.baseIterations,
				fragment.baseIterations[0],
				fragment.baseIterations[1],
			);
		}
		if (fragment.ignoresStatuses) {
			move.ignoresStatuses = resolveStatusesModifier(
				move.ignoresStatuses,
				fragment.ignoresStatuses[0],
				fragment.ignoresStatuses[1],
			);
		}
		if (fragment.operations) {
			[move.operations, move.loopOperations] = resolveOperationsModifier(
				move.operations,
				move.loopOperations,
				fragment.operations,
			);
		}
	}
	return move
}

export function buildCombatBlessing (
	blessing: BlessingTemplate,
	owner: CombatEntity,
): CombatBlessing {
	return {
		id: blessing.id,
		name: blessing.id,
		description: blessing.description,
		element: blessing.element,
		owner: owner,
		cooldownTurns: 0,
		isExhausted: false,
		isBound: false,
		listeners: blessing.listeners,
	};
}
