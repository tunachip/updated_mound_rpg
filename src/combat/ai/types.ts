// src/combat/ai/types.ts

import { Status, TargetType } from '../../shared';
import type { CombatEntity, CombatBlessing, CombatMove } from '../models';
import type { CombatState } from '../types';

export type CombatObject = CombatEntity | CombatBlessing | CombatMove | CombatState
export type GoalType = 'approach' | 'prevent' | 'maintain';
export type GoalHierarchy = Array<Goal>;
export type TemperamentChoice = 'progressive' | 'conservative' | 'ambivalent';

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

interface Temperament {
	progressive: number; // Prefer 'approach' & 'avoid'
	conservative: number;	// Prefer 'maintain'
	retaliatory: number; // When Hit, Increments Grudge modifier for Attacker.id
}

interface ProgressivePriorities {
	lowHp: number;
	maxDamage: number;
	canKill: number;
}

interface ConservationPriorities {
	lowHp: number;
	canSave: number;
}

export interface AiTuning {
	temperament: Temperament;
	progressivePriorities: ProgressivePriorities;
	conservationPriorities: ConservationPriorities;
	hasGrudges: boolean;
	grudges: Record<string, number>;

	foresight: number | null; // turns ahead ai can think
	goalWidth: number | null; // number of goals ai can eval at once
	goalWeightRolloff: number | null; // amount of weight taken off future turns each

	// Statuses
	maintainsAllyHp: ProfileField;
	maintainsHp: ProfileField;
	avoidsDeath: ProfileField;
	avoidsStatuses: Record<Status, ProfileField>;
	desiresStatuses: Record<Status, ProfileField>;
	appliesStatusesToEnemies: Record<Status, ProfileField>;
	appliesStatusesToAllies: Record<Status, ProfileField>;
}
