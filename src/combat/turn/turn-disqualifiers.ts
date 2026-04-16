// src/combat/turn/turn-disqualifiers.ts

import type { Status } from '../../shared';
import type { CombatEntity, CombatMove, TurnChoice } from '../models';

function isInvalid(
	entity: CombatEntity,
	move: CombatMove,
	status: Status,
): boolean {
	if (move.isBound) {
		return true;
	}
	if (move.isBanked) {
		return true;
	}

	if ((status === 'anger' && move.moveType === 'attack') ||
		(status === 'stun' && move.moveType === 'utility')) {
		return false;
	} else {
		return (
			entity.hasStatus[status]
			&& !(entity.ignoresStatusTurns[status] > 0)
			&& !move.ignoresStatuses.includes(status)
		);
	}
}

export function turnChoiceDisqualified(
	entity: CombatEntity,
	turnChoice: TurnChoice,
): boolean {
	const move = turnChoice.move;
	for (const status of ['sleep', 'stun', 'anger'] as const) {
		if (isInvalid(entity, move, status)) {
			return true;
		}
	}
	return false;
}
