// src/combat/turn/turn-disqualifiers.ts

import type { DamageElement, Status } from '../../shared';
import type { CombatEntity, CombatMove, TurnChoice } from '../models';

function validChain(
	moveElement: CombatMove['element'],
	lastChainedMoveElement: DamageElement,
): boolean {
	if (moveElement === 'neutral') {
		return false;
	}
	switch (lastChainedMoveElement) {
		case 'water':
			return moveElement == 'thunder'
					|| moveElement == 'stone';
		case 'stone':
			return moveElement == 'water'
					|| moveElement == 'fire';
		case 'fire':
			return moveElement == 'stone'
					|| moveElement == 'plant';
		case 'plant':
			return moveElement == 'fire'
					|| moveElement == 'force';
		case 'vital':
			return true;
		case 'force':
			return moveElement == 'plant'
					|| moveElement == 'thunder';
		case 'thunder':
			return moveElement == 'force'
					|| moveElement == 'water';
		default:
			return false;
	}
}

function isInvalid(
	entity: CombatEntity,
	move: CombatMove,
	status: Status,
	fromBeingChained: boolean = false,
	lastChainedMoveElement: DamageElement = 'water',
): boolean {
	if ((status === 'anger' && move.moveType === 'attack') ||
		(status === 'stun' && move.moveType === 'utility')) {
		return false;
	} else {
		return (
			entity.hasStatus[status]
			&& (move.isBound)
			&& (fromBeingChained === true && validChain(move.element, lastChainedMoveElement))
			&& !(entity.ignoresStatusTurns[status] > 0)
			&& !(move.ignoresStatuses[status])
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
