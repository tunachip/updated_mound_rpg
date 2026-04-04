// src/combat/ai/types.ts

import type { CombatEntity, CombatBlessing, CombatMove } from "../models";
import type { CombatState } from "../";

export type GoalKind = 'approach' | 'prevent' | 'maintain';

export interface Goal {
	id: string;
	name: string;
	kind: GoalKind;
	host: CombatEntity | CombatMove | CombatBlessing | CombatState;
	field: Array<string>;
	value: any;
	weight: number;
}

export type GoalHierarchy = Array<Goal>;

export interface AiTuning {
	aggression: number;
	selfPreservation: number;
	allyPreservation: number;
	statusAversion: number;
	energyValue: number;
	positioning: number;
}
