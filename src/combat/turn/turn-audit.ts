// src/combat/turn/turn-audit.ts

import type { Status, DamageElement } from '../../shared';
import { Statuses, DamageElements } from '../../shared/index.ts';
import type { CombatEntity, CombatMove, CombatBlessing } from '../models';
import type { CombatState } from '../types.ts';
import type { RegisteredRuntimeListener } from '../operations/index.ts';

interface TurnAudits {
	attunements: Array<DamageElement>;
	statuses: Array<Status>;
	ignoresStatuses: Array<Status>;
	cooldowns: Array<CombatMove|CombatBlessing>;
	listeners: Array<RegisteredRuntimeListener>;
}

export function audit (
	entity: CombatEntity,
	combat?: CombatState,
): TurnAudits {
	return {
		attunements: DamageElements.filter(
			element => entity.attunedTo[element] === true
		),
		statuses: Statuses.filter(
			status => entity.hasStatus[status] === true
		),
		ignoresStatuses: Statuses.filter(
			status => entity.ignoresStatusTurns[status] > 0
		),
		cooldowns: [
			...entity.moves,
			...entity.blessings
		].filter(
			effect => effect.cooldownTurns > 0
		),
		listeners: combat == null
			? []
			: combat.listeners.filter(
				(listener) =>
					listener.owner.id === entity.id &&
					listener.chargeTurns > 0,
			),
	};
}
