// src/combat/turn/turn-choices.ts

import { TurnChoice, CombatEntity } from '../models';

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
		targets: [],
	};
}

function aiChoice (
	entity: CombatEntity
): TurnChoice {
	// TODO: Create AI Choice Logic
	return {
		move: entity.moves[0],
		targets: [],
	};
}
