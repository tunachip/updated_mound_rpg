// src/data/templates/moves/types.ts

import type { DamageElement, MoveType } from '../../../shared';
import type { CombatTargetingRules } from '../../../combat/models';
import type { OperationStep } from '../../../combat/operations';

export interface MoveTemplate {
	id: string;
	name: string;
	description: string;
	type: MoveType;
	targeting: CombatTargetingRules;
	element: DamageElement;
	baseDamage: number;
	baseIterations: number;
	cooldownTurns: number;
	isBound: boolean;
	operations: Array<OperationStep>;
}
