// src/combat/ai/types.ts

import type { CombatEntity, CombatBlessing, CombatMove } from "../models";
import type { CombatState } from "../";

export interface Goal {
	name: string;
	host: CombatEntity | CombatMove | CombatBlessing | CombatState;
	field: Array<string>;
	value: any;
	weight: number;
}

export type GoalHierarchy = Array<Goal>;
