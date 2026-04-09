// src/combat/ai/snapshot.ts

import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';
import type { Goal } from './types.ts';
import type {
	SerializedBlessing,
	SerializedCombatEntity,
	SerializedCombatState,
	SerializedGoal,
	SerializedMove,
	SerializedTurnChoice,
	SerializedTargetMatrix,
} from './parallel-types.ts';
import {
	buildCombatBlessing,
	buildCombatEntity,
	buildCombatMove,
} from '../models/constructor.ts';
import {
	BlessingTemplatesById,
	FragmentTemplatesById,
	MoveTemplatesById,
} from '../../data/templates/index.ts';
import {
	applyEnergy,
	entityTargets,
	makeTargets,
	operation,
	selfTargets,
	type TargetMatrix,
} from '../operations/index.ts';
import { moveEntity } from '../operations/move-entity.ts';

function serializeMove(
	move: CombatMove,
): SerializedMove {
	return {
		id: move.id,
		templateId: move.templateId ?? null,
		fragmentIds: [...(move.fragmentIds ?? [])],
		name: move.name,
		description: move.description,
		isHidden: move.isHidden,
		element: move.element,
		moveType: move.moveType,
		targetType: {
			type: move.targetType.type,
			range: [...move.targetType.range] as [number, number],
		},
		baseDamage: move.baseDamage,
		baseIterations: move.baseIterations,
		cooldownTurns: move.cooldownTurns,
		isBound: move.isBound,
		canBeChainedInto: move.canBeChainedInto,
		ignoresStatuses: [...move.ignoresStatuses],
	};
}

function serializeBlessing(
	blessing: CombatBlessing,
): SerializedBlessing {
	return {
		id: blessing.id,
		templateId: blessing.templateId ?? null,
		name: blessing.name,
		description: blessing.description,
		isHidden: blessing.isHidden,
		element: blessing.element,
		cooldownTurns: blessing.cooldownTurns,
		isExhausted: blessing.isExhausted,
		isBound: blessing.isBound,
	};
}

function serializeGoalHost(
	host: Goal['host'],
): Pick<SerializedGoal, 'hostType' | 'hostId'> {
	if ('entityType' in host) {
		return {
			hostType: 'entity',
			hostId: host.id,
		};
	}
	if ('moveType' in host) {
		return {
			hostType: 'move',
			hostId: host.id,
		};
	}
	if ('listeners' in host && 'isExhausted' in host) {
		return {
			hostType: 'blessing',
			hostId: host.id,
		};
	}
	return {
		hostType: 'combat',
		hostId: null,
	};
}

function serializeGoal(
	goal: Goal,
): SerializedGoal {
	const host = serializeGoalHost(goal.host);
	return {
		id: goal.id,
		name: goal.name,
		kind: goal.kind,
		hostType: host.hostType,
		hostId: host.hostId,
		field: [...goal.field],
		value: goal.value,
		weight: goal.weight,
	};
}

function serializeEntity(
	entity: CombatEntity,
): SerializedCombatEntity {
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
		extraIterations: entity.extraIterations,
		isDead: entity.isDead,
		shieldsBroken: entity.shieldsBroken,
		isBloody: entity.isBloody,
		curseChance: entity.curseChance,
		attunedTo: { ...entity.attunedTo },
		turnsAttuned: { ...entity.turnsAttuned },
		hasStatus: { ...entity.hasStatus },
		statusTurns: { ...entity.statusTurns },
		statusMaxTurns: { ...entity.statusMaxTurns },
		ignoresStatusTurns: { ...entity.ignoresStatusTurns },
		maxDamageTaken: entity.maxDamageTaken,
		lastDamageTaken: entity.lastDamageTaken,
		totalDamageTaken: entity.totalDamageTaken,
		dodges: entity.dodges,
		aiTuning: { ...entity.aiTuning },
		moves: entity.moves.map(serializeMove),
		blessings: entity.blessings.map(serializeBlessing),
		goals: entity.goals.map(serializeGoal),
	};
}

export function serializeCombatPlanningState(
	combat: CombatState,
): SerializedCombatState {
	return {
		turn: combat.turn,
		hasPriority: combat.hasPriority,
		entities: {
			party: combat.entities.party.map(serializeEntity),
			encounters: combat.entities.encounters.map(serializeEntity),
		},
	};
}

function buildPlanningEntity(
	serialized: SerializedCombatEntity,
): CombatEntity {
	const entity = buildCombatEntity({
		id: serialized.id,
		name: serialized.name,
		level: serialized.level,
		xp: 0,
		entityType: serialized.entityType,
		hp: serialized.hp,
		maxHp: serialized.maxHp,
		energy: serialized.energy,
		maxEnergy: serialized.maxEnergy,
		shields: serialized.shields,
		aiTuning: serialized.aiTuning,
		moves: [],
		blessings: [],
		inventory: [],
	});

	entity.extraIterations = serialized.extraIterations;
	entity.isDead = serialized.isDead;
	entity.shieldsBroken = serialized.shieldsBroken;
	entity.isBloody = serialized.isBloody;
	entity.curseChance = serialized.curseChance;
	entity.attunedTo = { ...serialized.attunedTo };
	entity.turnsAttuned = { ...serialized.turnsAttuned };
	entity.hasStatus = { ...serialized.hasStatus };
	entity.statusTurns = { ...serialized.statusTurns };
	entity.statusMaxTurns = { ...serialized.statusMaxTurns };
	entity.ignoresStatusTurns = { ...serialized.ignoresStatusTurns };
	entity.maxDamageTaken = serialized.maxDamageTaken;
	entity.lastDamageTaken = serialized.lastDamageTaken;
	entity.totalDamageTaken = serialized.totalDamageTaken;
	entity.dodges = serialized.dodges;
	entity.goals = [];
	entity.turnChoices = [];
	entity.knowledge = [];

	return entity;
}

function hydrateMove(
	owner: CombatEntity,
	serialized: SerializedMove,
): CombatMove {
	const templateId = serialized.templateId ?? serialized.id;
	const template = MoveTemplatesById.get(templateId);
	if (!template) {
		throw new Error(`Unknown move template '${templateId}' for worker planning.`);
	}

	const fragments = serialized.fragmentIds
		.map((fragmentId) => FragmentTemplatesById.get(fragmentId))
		.filter((fragment) => fragment != null);

	const move = buildCombatMove(template, fragments, owner);
	move.id = serialized.id;
	move.templateId = templateId;
	move.fragmentIds = [...serialized.fragmentIds];
	move.name = serialized.name;
	move.description = serialized.description;
	move.isHidden = serialized.isHidden;
	move.element = serialized.element;
	move.moveType = serialized.moveType;
	move.targetType = {
		type: serialized.targetType.type,
		range: [...serialized.targetType.range] as [number, number],
	};
	move.baseDamage = serialized.baseDamage;
	move.baseIterations = serialized.baseIterations;
	move.cooldownTurns = serialized.cooldownTurns;
	move.isBound = serialized.isBound;
	move.canBeChainedInto = serialized.canBeChainedInto;
	move.ignoresStatuses = [...serialized.ignoresStatuses];
	return move;
}

function hydrateBlessing(
	owner: CombatEntity,
	serialized: SerializedBlessing,
): CombatBlessing {
	const templateId = serialized.templateId ?? serialized.id;
	const template = BlessingTemplatesById.get(templateId);
	if (!template) {
		throw new Error(`Unknown blessing template '${templateId}' for worker planning.`);
	}

	const blessing = buildCombatBlessing(template, owner);
	blessing.id = serialized.id;
	blessing.templateId = templateId;
	blessing.name = serialized.name;
	blessing.description = serialized.description;
	blessing.isHidden = serialized.isHidden;
	blessing.element = serialized.element;
	blessing.cooldownTurns = serialized.cooldownTurns;
	blessing.isExhausted = serialized.isExhausted;
	blessing.isBound = serialized.isBound;
	return blessing;
}

function resolveGoalHost(
	combat: CombatState,
	entityById: Map<string, CombatEntity>,
	moveById: Map<string, CombatMove>,
	blessingById: Map<string, CombatBlessing>,
	goal: SerializedGoal,
): Goal['host'] {
	switch (goal.hostType) {
		case 'entity': {
			const entity = goal.hostId
				? entityById.get(goal.hostId)
				: null;
			if (!entity) {
				throw new Error(`Unknown goal entity host '${goal.hostId}'.`);
			}
			return entity;
		}
		case 'move': {
			const move = goal.hostId
				? moveById.get(goal.hostId)
				: null;
			if (!move) {
				throw new Error(`Unknown goal move host '${goal.hostId}'.`);
			}
			return move;
		}
		case 'blessing': {
			const blessing = goal.hostId
				? blessingById.get(goal.hostId)
				: null;
			if (!blessing) {
				throw new Error(`Unknown goal blessing host '${goal.hostId}'.`);
			}
			return blessing;
		}
		case 'combat':
			return combat;
	}
}

export function hydrateCombatPlanningState(
	snapshot: SerializedCombatState,
): CombatState {
	const combat: CombatState = {
		turn: snapshot.turn,
		hasPriority: snapshot.hasPriority,
		entities: {
			party: snapshot.entities.party.map(buildPlanningEntity),
			encounters: snapshot.entities.encounters.map(buildPlanningEntity),
		},
		listeners: [],
		eventLog: [],
		aiCache: null,
	};

	const entityById = new Map<string, CombatEntity>();
	const moveById = new Map<string, CombatMove>();
	const blessingById = new Map<string, CombatBlessing>();

	for (const entity of [
		...combat.entities.party,
		...combat.entities.encounters
	]) {
		entityById.set(entity.id, entity);
	}

	for (const serializedEntity of [
		...snapshot.entities.party,
		...snapshot.entities.encounters,
	]) {
		const entity = entityById.get(serializedEntity.id);
		if (!entity) {
			continue;
		}

		entity.moves = serializedEntity.moves.map((move) => {
			const hydrated = hydrateMove(entity, move);
			moveById.set(hydrated.id, hydrated);
			return hydrated;
		});

		entity.blessings = serializedEntity.blessings.map((blessing) => {
			const hydrated = hydrateBlessing(entity, blessing);
			blessingById.set(hydrated.id, hydrated);
			return hydrated;
		});
	}

	for (const serializedEntity of [
		...snapshot.entities.party,
		...snapshot.entities.encounters,
	]) {
		const entity = entityById.get(serializedEntity.id);
		if (!entity) {
			continue;
		}

		entity.goals = serializedEntity.goals.map((goal) => ({
			id: goal.id,
			name: goal.name,
			kind: goal.kind,
			host: resolveGoalHost(
				combat,
				entityById,
				moveById,
				blessingById,
				goal,
			),
			field: [...goal.field],
			value: goal.value,
			weight: goal.weight,
		}));
	}

	return combat;
}

function serializeTargets(
	targets: TargetMatrix,
): SerializedTargetMatrix {
	return {
		entityIds: targets.entities.map((entity) => entity.id),
		moveIds: targets.moves.map((move) => move.id),
		blessingIds: targets.blessings.map((blessing) => blessing.id),
	};
}

export function serializeTurnChoice(
	choice: {
		move: CombatMove;
		targets: TargetMatrix;
		isFocus?: boolean
	},
): SerializedTurnChoice {
	return {
		moveId: choice.move.id,
		targets: serializeTargets(choice.targets),
		isFocus: choice.isFocus,
	};
}

function focusChoiceForEntity(
	entity: CombatEntity,
) {
	return {
		move: {
			id: `focus:${entity.id}`,
			name: 'Focus',
			description: 'Skip turn and gain 1 energy.',
			templateId: undefined,
			fragmentIds: [],
			isHidden: false,
			element: 'neutral' as const,
			moveType: 'focus' as const,
			owner: entity,
			targetType: {
				type: 'self' as const,
				range: [0, 0] as [number, number],
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

function repositionChoiceForEntity(
	entity: CombatEntity,
	index: number,
) {
	return {
		move: {
			id: `move:${entity.id}:${index}`,
			name: 'Reposition',
			description: 'Move to a new position in the team order.',
			templateId: undefined,
			fragmentIds: [],
			isHidden: false,
			element: 'neutral' as const,
			moveType: 'focus' as const,
			owner: entity,
			targetType: {
				type: 'self' as const,
				range: [0, 0] as [number, number],
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
	};
}

export function hydrateSerializedTurnChoice(
	combat: CombatState,
	entityId: string,
	serialized: SerializedTurnChoice,
) {
	const entities = [
		...combat.entities.party,
		...combat.entities.encounters
	];
	const entity = entities.find(
		(candidate) => candidate.id === entityId
	);
	if (!entity) {
		throw new Error(`Unknown entity '${entityId}' while hydrating worker turn choice.`);
	}

	const move = entity.moves.find((candidate) => candidate.id === serialized.moveId);
	if (move) {
		return {
			move,
			targets: makeTargets({
				entities: serialized.targets.entityIds
					.map((id) => entities.find((candidate) => candidate.id === id))
					.filter((candidate) => candidate != null),
				moves: entities.flatMap((candidate) => candidate.moves)
					.filter((candidate) => serialized.targets.moveIds.includes(candidate.id)),
				blessings: entities.flatMap((candidate) => candidate.blessings)
					.filter((candidate) => serialized.targets.blessingIds.includes(candidate.id)),
			}),
			isFocus: serialized.isFocus,
		};
	}

	if (serialized.moveId === `focus:${entity.id}`) {
		return focusChoiceForEntity(entity);
	}

	const repositionPrefix = `move:${entity.id}:`;
	if (serialized.moveId.startsWith(repositionPrefix)) {
		const index = Number(
			serialized.moveId.slice(repositionPrefix.length)
		);
		return repositionChoiceForEntity(entity, index);
	}

	throw new Error(`Unknown serialized move '${serialized.moveId}' for entity '${entity.id}'.`);
}
