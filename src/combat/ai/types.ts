// src/combat/ai/types.ts

import { Status, TargetType } from '../../shared';
import type { CombatEntity, CombatBlessing, CombatMove } from '../models';
import type { CombatState } from '../types';

export type CombatObject = CombatEntity | CombatBlessing | CombatMove | CombatState
export type GoalType = 'approach' | 'prevent' | 'maintain';
export type GoalHierarchy = Array<Goal>;

export interface Goal {
	id: string;
	name: string;
	goalType: GoalType;
	host: CombatObject;
	targetType: TargetType;
	field: Array<string>;
	value: any;
	weight: number;
}

interface ProfileField {
	amount: number;
	weight: number;
}

export interface AiTuning {

	// === MOVE TYPE PREFERRANCES ===
	prefersAttacking: ProfileField;

	// === OFFENSIVE TRAITS ===

	// Ideal Target Description
	killsWeakFirst: ProfileField;
	aggressive: ProfileField;
	retaliatory: ProfileField;

	// === DEFENSIVE TRAITS ===
	
	// Statuses
	maintainsAllyHp: ProfileField;
	maintainsHp: ProfileField;
	avoidsDeath: ProfileField;
	avoidsStatuses: Record<Status, ProfileField>;
	desiresStatuses: Record<Status, ProfileField>;
	appliesStatusesToEnemies: Record<Status, ProfileField>;
	appliesStatusesToAllies: Record<Status, ProfileField>;
}
