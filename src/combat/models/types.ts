// src/combat/models/types.ts

import type { DamageElement, EntityType, MoveType, Status, TargetType } from '../../shared';
import type { Listener, Operation, TargetMatrix } from '../operations';
import type { AiTuning, GoalHierarchy } from '../ai';

export interface CombatTargetingRules {
	type: TargetType;
	range: [min: number, max: number];
}

export interface TurnChoice {
	move: CombatMove;
	targets: TargetMatrix;
	isFocus?: boolean;
}

export interface CombatEntity {
	id: string;
	name: string;
	level: number;
	entityType: EntityType;
	hp: number;
	maxHp: number;
	energy: number;
	maxEnergy: number;
	shields: number;
	extraIterations: number;
	isDead: boolean;
	shieldsBroken: boolean;
	isBloody: boolean;
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
	dodges: number;
	knowledge: Array<any>;
	aiTuning: AiTuning;
	goals: GoalHierarchy;
}

export interface CombatMove {
	id: string;
	templateId?: string;
	fragmentIds?: Array<string>;
	name: string;
	description: string;
	isHidden: boolean;
	element: DamageElement | 'neutral';
	moveType: MoveType | 'focus';
	owner: CombatEntity;
	targetType: CombatTargetingRules;
	baseDamage: number;
	baseIterations: number;
	cooldownTurns: number;
	isBound: boolean;
	canBeChainedInto: boolean;
	ignoresStatuses: Array<Status>;
	operations: Array<Operation>;
	loopOperations: Array<Operation>;
}

export interface CombatBlessing {
	id: string;
	templateId?: string;
	name: string;
	description: string;
	isHidden: boolean;
	element: DamageElement;
	owner: CombatEntity;
	cooldownTurns: number;
	isExhausted: boolean;
	isBound: boolean;
	listeners: Array<Listener>;
}
