// src/combat/models/types.ts

import type { DamageElement, EntityType, MoveType, Status } from '../../shared';
import type { Listener, Operation, TargetMatrix } from '../operations';

export interface CombatTargetingRules {
	type: 'self' | 'ally' | 'enemy' | 'entity' | 'move' | 'blessing';
	range: [min: number, max: number];
}

export interface TurnChoice {
	move: CombatMove;
	targets: TargetMatrix;
}

export interface CombatEntity {
	id: string;
	name: string;
	entityType: EntityType;
	hp: number;
	maxHp: number;
	energy: number;
	maxEnergy: number;
	shields: number;
	extraIterations: number;
	isDead: boolean;
	shieldsBroken: boolean;
	curseChance: number;
	attunedTo: Record<DamageElement, boolean>;
	turnsAttuned: Record<DamageElement, number>;
	hasStatus: Record<Status, boolean>;
	statusTurns: Record<Status, number>;
	statusMaxTurns: Record<Status, number>;
	ignoresStatusTurns: Record<Status, number>;
	maxDamageTaken: number;
	lastDamageTaken: number;
	totalDamageTaken: number;
	moves: Array<CombatMove>;
	blessings: Array<CombatBlessing>;
	turnChoices: Array<TurnChoice>;
}

export interface CombatMove {
	id: string;
	name: string;
	description: string;
	element: DamageElement;
	moveType: MoveType;
	owner: CombatEntity;
	targeting: CombatTargetingRules;
	baseDamage: number;
	baseIterations: number;
	cooldownTurns: number;
	currentCooldownTurns: number;
	isBound: boolean;
	ignoresStatuses: Array<Status>;
	operations: Array<Operation>;
}

export interface CombatBlessing {
	id: string;
	name: string;
	description: string;
	element: DamageElement;
	owner: CombatEntity;
	cooldownTurns: number;
	currentCooldownTurns: number;
	isExhausted: boolean;
	isBound: boolean;
	listeners: Array<Listener>;
}
