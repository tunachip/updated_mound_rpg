// src/combat/ai/listeners.ts

import type { Status } from '../../shared';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';
import {
	adjustGoalWeight,
	changeAfterGreaterThanBefore,
	changeHostIsOwner,
	emptyTargets,
	listener,
	operation,
	selfTargets,
	type Listener,
	type Operation,
	type OperationContext,
	type RegisteredRuntimeListener,
} from '../operations/index.ts';

interface EntityAiCapabilities {
	selfStatusRelief: Map<Status, number>;
}

function isAiGoalListener(
	registered: RegisteredRuntimeListener,
): boolean {
	return registered.listener.id.startsWith('ai:goal:');
}

function addStatusRelief(
	capabilities: EntityAiCapabilities,
	status: Status,
	strength: number,
): void {
	const current = capabilities.selfStatusRelief.get(status) ?? 0;
	capabilities.selfStatusRelief.set(status, current + strength);
}

function nestedOperations(
	operation: Operation,
): Array<Operation> {
	return [
		...(operation.ctx?.operations ?? []),
		...(operation.ctx?.elseOperations ?? []),
		...(operation.ctx?.listeners ?? []).flatMap(
			(listener) => listener.operations
		),
	];
}

function operationTargetsOwner(
	combat: CombatState,
	owner: CombatEntity,
	operation: Operation,
	sourceMove: CombatMove | null,
	sourceBlessing: CombatBlessing | null,
	defaultTargetsOwner: boolean,
): boolean {
	if (!operation.resolveTargets) {
		return defaultTargetsOwner;
	}

	const ctx: OperationContext = {
		combat,
		caster: owner,
		move: sourceMove,
		blessing: sourceBlessing,
		targets: emptyTargets(),
		change: {
			host: owner,
			field: ['id'],
			before: owner.id,
			after: owner.id,
		},
	};

	try {
		return operation.resolveTargets(ctx).entities.some(
			(entity) => entity.id === owner.id,
		);
	} catch {
		return defaultTargetsOwner;
	}
}

function scanOperationTree(
	combat: CombatState,
	owner: CombatEntity,
	operation: Operation,
	sourceMove: CombatMove | null,
	sourceBlessing: CombatBlessing | null,
	capabilities: EntityAiCapabilities,
	defaultTargetsOwner: boolean,
): void {
	const affectsOwner = operationTargetsOwner(
		combat,
		owner,
		operation,
		sourceMove,
		sourceBlessing,
		defaultTargetsOwner,
	);

	if (affectsOwner) {
		const status = operation.ctx?.status;
		switch (operation.name) {
			case 'negateStatus':
				if (status) {
					addStatusRelief(capabilities, status, 2);
				}
				break;
			case 'reduceStatusTurns':
				if (status) {
					addStatusRelief(capabilities, status, 1);
				}
				break;
		}
	}

	for (const child of nestedOperations(operation)) {
		scanOperationTree(
			combat,
			owner,
			child,
			sourceMove,
			sourceBlessing,
			capabilities,
			defaultTargetsOwner,
		);
	}
}

function scanMoveCapabilities(
	combat: CombatState,
	entity: CombatEntity,
	move: CombatMove,
	capabilities: EntityAiCapabilities,
): void {
	const defaultTargetsOwner =
		move.targetType.type === 'self' ||
		move.targetType.type === 'entity';

	const operations = [
	  ...move.operations,
	  ...move.loopOperations
	];
	for (const operation of operations) {
		scanOperationTree(
			combat,
			entity,
			operation,
			move,
			null,
			capabilities,
			defaultTargetsOwner,
		);
	}
}

function scanBlessingCapabilities(
	combat: CombatState,
	entity: CombatEntity,
	blessing: CombatBlessing,
	capabilities: EntityAiCapabilities,
): void {
	for (const listener of blessing.listeners) {
		for (const operation of listener.operations) {
			scanOperationTree(
				combat,
				entity,
				operation,
				null,
				blessing,
				capabilities,
				false,
			);
		}
	}
}

function collectEntityAiCapabilities(
	combat: CombatState,
	entity: CombatEntity,
): EntityAiCapabilities {
	const capabilities: EntityAiCapabilities = {
		selfStatusRelief: new Map(),
	};

	for (const move of entity.moves) {
		scanMoveCapabilities(
		  combat,
		  entity,
		  move,
		  capabilities
		);
	}
	for (const blessing of entity.blessings) {
		scanBlessingCapabilities(
		  combat,
		  entity,
		  blessing,
		  capabilities
		);
	}

	return capabilities;
}

function statusReliefListener(
	entity: CombatEntity,
	status: Status,
	strength: number,
): Listener {
	return listener({
		id: `ai:goal:self-status-relief:${entity.id}:${status}`,
		phase: 'sideEffect',
		trigger: `entity.statusTurns.${status}`,
		conditions: [
			changeHostIsOwner(),
			changeAfterGreaterThanBefore(),
		],
		operations: [
			operation(adjustGoalWeight, {
				ctx: {
					amount: strength * entity.aiTuning.statusAversion,
					goalKind: 'prevent',
					goalField: ['statusTurns', status],
					goalValue: 0,
				},
				targets: selfTargets(),
			}),
		],
	});
}

function buildAiGoalListeners(
	combat: CombatState,
	entity: CombatEntity,
): Array<RegisteredRuntimeListener> {
	const capabilities = collectEntityAiCapabilities(combat, entity);
	const listeners: Array<RegisteredRuntimeListener> = [];

	for (const [status, strength] of capabilities.selfStatusRelief) {
		listeners.push({
			owner: entity,
			move: null,
			blessing: null,
			listener: statusReliefListener(entity, status, strength),
		});
	}

	return listeners;
}

export function hydrateAiGoalListeners(
	combat: CombatState,
): Array<RegisteredRuntimeListener> {
	const entities = [
		...combat.entities.party,
		...combat.entities.encounters
	];
	const activeOwnerIds = new Set(entities.map((entity) => entity.id));
	const preserved = combat.listeners.filter(
		(registered) =>
			!isAiGoalListener(registered) &&
			activeOwnerIds.has(registered.owner.id),
	);
	const generated = [
		...combat.entities.party,
		...combat.entities.encounters,
	].flatMap((entity) => buildAiGoalListeners(combat, entity));
	combat.listeners = [...preserved, ...generated];
	return combat.listeners;
}
