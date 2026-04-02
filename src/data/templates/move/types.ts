// src/data/templates/moves/types.ts

import type { DamageElement, Status, MoveType } from '../../../shared';
import type { CombatTargetingRules } from '../../../combat/models';
import type { Operation } from '../../../combat/operations';

export interface MoveTemplate {
	id: string;
	name: string;
	description: string;
	moveType: MoveType;
	targetType: CombatTargetingRules;
	element: DamageElement;
	baseDamage: number;
	baseIterations: number;
	ignoresStatuses: Array<Status>;
	operations: Array<Operation>;
	loopOperations: Array<Operation>;
}
