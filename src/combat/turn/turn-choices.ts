// src/combat/turn/turn-choices.ts

import type { TurnChoice, CombatEntity } from '../models';
import type { CombatState } from '../types.ts';
import { calculateTurnChoices } from '../ai/index.ts';

export function makeTurnChoices (
	combat: CombatState,
	entity: CombatEntity
): Array<[TurnChoice, boolean]> {
	// second value is if the player can 'see' the intent
	switch (entity.entityType) {
		case 'controlled':
			return [[playerChoice(combat, entity), true]];
		case 'forecasted':
			return aiChoices(combat, entity, true);
		case 'hidden':
			return aiChoices(combat, entity, false);
	}
}

function playerChoice (
	combat: CombatState,
	entity: CombatEntity
): TurnChoice {
	return calculateTurnChoices(combat, entity)[0];
}

function aiChoices(
	combat: CombatState,
	entity: CombatEntity,
	isPlayerKnown: boolean,
): Array<[TurnChoice, boolean]> {
	return calculateTurnChoices(combat, entity).map((choice) => [
		choice,
		isPlayerKnown,
	]);
}
