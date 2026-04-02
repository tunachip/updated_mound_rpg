// src/combat/turn/turn-audit.ts

import type { Status, DamageElement } from '../../shared';
import { Statuses, DamageElements } from '../../shared';
import type { CombatEntity, CombatMove, CombatBlessing } from '../models';

interface TurnAudits {
	attunements: Array<DamageElement>;
	statuses: Array<Status>;
	cooldowns: Array<CombatMove|CombatBlessing>;
}

export function audit (
	entity: CombatEntity
): TurnAudits {
	return {
		attunements: DamageElements.filter(
			element => entity.attunedTo[element] === true
		),
		statuses: Statuses.filter(
			status => entity.hasStatus[status] === true
		),
		cooldowns: [
			...entity.moves,
			...entity.blessings
		].filter(
			effect => effect.cooldownTurns > 0
		)
	};
}
