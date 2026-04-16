// src/combat/ai/parallel-types.ts

import type { GoalKind } from './types.ts';
import type { CombatTeam } from '../../shared';
import type { CombatTargetingRules } from '../models';
import type { AiTuning } from './types.ts';
import type { DamageElement, EntityType, MoveType, Status } from '../../shared';

export interface SerializedGoal {
	id: string;
	name: string;
	kind: GoalKind;
	hostType: 'entity' | 'move' | 'blessing' | 'combat';
	hostId: string | null;
	field: Array<string>;
	value: unknown;
	weight: number;
}

export interface SerializedMove {
	id: string;
	templateId: string | null;
	fragmentIds: Array<string>;
	name: string;
	description: string;
	isHidden: boolean;
	element: DamageElement | 'neutral';
	moveType: MoveType | 'focus';
	targetType: CombatTargetingRules;
	baseDamage: number;
	baseIterations: number;
	cooldownTurns: number;
	isBound: boolean;
	isBanked: boolean;
	canBeChainedInto: boolean;
	ignoresStatuses: Array<Status>;
}

export interface SerializedBlessing {
	id: string;
	templateId: string | null;
	name: string;
	description: string;
	isHidden: boolean;
	element: DamageElement;
	cooldownTurns: number;
	isExhausted: boolean;
	isBound: boolean;
}

export interface SerializedCombatEntity {
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
	dodges: number;
	aiTuning: AiTuning;
	moves: Array<SerializedMove>;
	blessings: Array<SerializedBlessing>;
	goals: Array<SerializedGoal>;
}

export interface SerializedCombatState {
	turn: number;
	hasPriority: CombatTeam;
	entities: {
		party: Array<SerializedCombatEntity>;
		encounters: Array<SerializedCombatEntity>;
	};
}

export interface SerializedTargetMatrix {
	entityIds: Array<string>;
	moveIds: Array<string>;
	blessingIds: Array<string>;
}

export interface SerializedTurnChoice {
	moveId: string;
	targets: SerializedTargetMatrix;
	isFocus?: boolean;
}

export interface PlanningWorkerRequest {
	snapshot: SerializedCombatState;
	entityIds: Array<string>;
}

export interface PlanningWorkerResult {
	elapsedMs: number;
	choicesByEntityId: Record<string, Array<SerializedTurnChoice>>;
}
