// src/combat/ai/types.ts

import type { CombatEntity, CombatBlessing, CombatMove } from "../models/index.ts";
import type { CombatState } from "../types.ts";


export type GoalKind = 'approach' | 'prevent' | 'maintain';
export type GoalHierarchy = Array<Goal>;

export interface Goal {
	id: string;
	name: string;
	kind: GoalKind;
	host: CombatEntity | CombatMove | CombatBlessing | CombatState;
	field: Array<string>;
	value: any;
	weight: number;
}

export interface AiRoleFlags {
	killEnemies: boolean;
	avoidDeath: boolean;
	healAllies: boolean;
	supportAllies: boolean;
	applyStatuses: boolean;
	cleanseStatuses: boolean;
	manipulateAttunements: boolean;
	manipulateMoves: boolean;
}

export interface AiTuning {
	roles: AiRoleFlags;
	aggression: number;
	selfPreservation: number;
	allyPreservation: number;
	statusAversion: number;
	energyValue: number;
	positioning: number;
	foresight: number | null;
	goalWidth: number | null;
	goalWeightRolloff: number | null;
}
