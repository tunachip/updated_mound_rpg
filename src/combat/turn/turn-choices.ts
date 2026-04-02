// src/combat/turn/turn-choices.ts

import type { TurnChoice, CombatEntity } from '../models';
import { emptyTargets } from '../operations';

export function makeTurnChoices (
	entity: CombatEntity
): Array<[TurnChoice, boolean]> {
	switch (entity.entityType) {
		case 'controlled':
			return [[playerChoice(entity), true]];
		case 'forecasted':
			return [[aiChoice(entity), true]];
		case 'hidden':
			return [[aiChoice(entity), false]];
	}
}

function playerChoice (
	entity: CombatEntity
): TurnChoice {
	// TODO: Create Player Choice Logic
	return {
		move: entity.moves[0],
		targets: emptyTargets(),
	};
}

function aiChoice (
	entity: CombatEntity
): TurnChoice {
	// TODO: Create AI Choice Logic
	return {
		move: entity.moves[0],
		targets: emptyTargets(),
	};
}
