// src/combat/operations/types.ts

import type { DamageElement, Status, EntityType } from '../../shared';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';

export interface TargetMatrix {
	entities: Array<CombatEntity>;
	moves: Array<CombatMove>;
	blessings: Array<CombatBlessing>;
}

export interface OperationContext {
	caster: CombatEntity;
	move: CombatMove;
	targets: TargetMatrix;
	entityType?: EntityType;
	element?: DamageElement;
	status?: Status;
	amount?: number;
}

export interface Operation {
	function: Function;
	requirements: Array<any>;
}
