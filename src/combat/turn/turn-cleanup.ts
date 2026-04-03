// src/combat/turn/turn-cleanup.ts

import { CombatEntity } from "../models";

export function cleanupEntity (
	entity: CombatEntity
): void {
	entity.extraIterations = 0;
	entity.shieldsBroken = false;
	entity.turnChoices = [];
	entity.dodges = 0;
}
