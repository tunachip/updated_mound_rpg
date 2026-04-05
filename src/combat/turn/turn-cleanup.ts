// src/combat/turn/turn-cleanup.ts

import type { CombatEntity } from '../models/index.ts';

export function cleanupEntity (
	entity: CombatEntity
): void {
	entity.extraIterations = 0;
	entity.shieldsBroken = false;
	entity.turnChoices = [];
	entity.dodges = 0;
}
