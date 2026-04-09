// src/combat/models/constructor.ts

import { createRecord, defaultStatusMaxTurns, Statuses, DamageElements } from '../../shared/index.ts';
import type { Status, ModifierExpression } from '../../shared';
import type { CombatEntity, CombatMove, CombatBlessing } from '../';
import type { FragmentTemplate, EntityTemplate, MoveTemplate, BlessingTemplate } from '../../data/templates';
import type { Operation } from '../operations';
import { defaultAiTuning } from '../ai/goals.ts';

function resolveNumberModifier(
	base: number,
	expression: ModifierExpression,
	modifier: number,
): number {
	switch (expression) {
		case 'overwrittenBy':
			return modifier;
		case 'plus':
			return base + modifier;
		case 'minus':
			return base - modifier;
		case 'times':
			return base * modifier;
		case 'dividedBy':
			return base / modifier;
		default:
			return base;
	}
}

function resolveStatusesModifier(
	base: Array<Status>,
	expression: ModifierExpression,
	modifier: Array<Status>,
): Array<Status> {
	switch (expression) {
		case 'overwrittenBy':
			return modifier;
		case 'merge':
			return [...base, ...modifier];
		default:
			return base;
	}
}

function resolveOperationModifier(
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

function resolveOperationsModifier(
	base: Array<Operation>,
	baseLoop: Array<Operation>,
	instructions: Array<[ModifierExpression, Operation]>,
): [Array<Operation>, Array<Operation>] {
	for (const [expression, modifier] of instructions) {
		[base, baseLoop] = resolveOperationModifier(
			base,
			baseLoop,
			expression,
			modifier,
		);
	}
	return [base, baseLoop];
}

function applyFragmentToMove(
	move: CombatMove,
	fragment: FragmentTemplate,
): CombatMove {
	if (fragment.element) {
		move.element = fragment.element;
	}

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
	return move;
}

export function buildCombatEntities(
	templates: Array<EntityTemplate>,
): Array<CombatEntity> {
	return templates.map(buildCombatEntityFromTemplate);
}

export function buildCombatEntityFromTemplate(
	template: EntityTemplate,
): CombatEntity {
	const entity = buildCombatEntity(template);
	entity.moves = template.moves.map(([moveTemplate, fragments]) =>
		buildCombatMove(moveTemplate, fragments, entity)
	);
	entity.blessings = template.blessings.map((blessingTemplate) =>
		buildCombatBlessing(blessingTemplate, entity)
	);
	return entity;
}

export function buildCombatEntity(
	entity: EntityTemplate,
): CombatEntity {
	return {
		id: entity.id,
		name: entity.name,
		level: entity.level,
		entityType: entity.entityType,
		hp: entity.hp,
		maxHp: entity.maxHp,
		energy: entity.energy,
		maxEnergy: entity.maxEnergy,
		shields: entity.shields,
		extraIterations: 0,
		isDead: false,
		shieldsBroken: false,
		isBloody: false,
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
		dodges: 0,
		knowledge: [],
		aiTuning: {
			...defaultAiTuning,
			...(entity.aiTuning ?? {}),
		},
		goals: [],
	};
}

export function buildCombatMove(
	moveTemplate: MoveTemplate,
	fragments: Array<FragmentTemplate>,
	owner: CombatEntity,
): CombatMove {
	let move: CombatMove = {
		id: moveTemplate.id,
		templateId: moveTemplate.id,
		fragmentIds: fragments.map((fragment) => fragment.id),
		name: moveTemplate.name,
		description: moveTemplate.description,
		isHidden: true,
		element: moveTemplate.element,
		moveType: moveTemplate.moveType,
		owner,
		targetType: moveTemplate.targetType,
		baseDamage: moveTemplate.baseDamage,
		cooldownTurns: 0,
		isBound: false,
		canBeChainedInto: moveTemplate.canBeChainedInto ?? false,
		baseIterations: moveTemplate.baseIterations,
		ignoresStatuses: moveTemplate.ignoresStatuses,
		operations: moveTemplate.operations,
		loopOperations: moveTemplate.loopOperations,
	};
	for (const fragment of fragments) {
		move = applyFragmentToMove(move, fragment);
	}
	return move;
}

export function buildCombatBlessing(
	blessing: BlessingTemplate,
	owner: CombatEntity,
): CombatBlessing {
	return {
		id: blessing.id,
		templateId: blessing.id,
		name: blessing.name,
		description: blessing.description,
		isHidden: true,
		element: blessing.element,
		owner,
		cooldownTurns: 0,
		isExhausted: false,
		isBound: false,
		listeners: blessing.listeners,
	};
}
