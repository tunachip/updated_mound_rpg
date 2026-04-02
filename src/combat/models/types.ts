// src/combat/models/types.ts

import type { DamageElement, EntityType, MoveType, Status } from '../../shared';
import type { BlessingListener, OperationStep } from '../operations';

export interface CombatTargetingRules {
	type: 'self' | 'ally' | 'enemy' | 'entity' | 'move' | 'blessing';
	range: [min: number, max: number];
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
	maxDamageTaken: number;
	lastDamageTaken: number;
	totalDamageTaken: number;
	moves: Array<CombatMove>;
	blessings: Array<CombatBlessing>;
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
	isBound: boolean;
	steps: Array<OperationStep>;
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
	listeners: Array<BlessingListener>;
}
