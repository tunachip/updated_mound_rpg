// src/combat/turn/turn-choices.ts

import type { TurnChoice, CombatEntity } from '../models';
import { emptyTargets } from '../operations/index.ts';

export function makeTurnChoices (
	entity: CombatEntity
): Array<[TurnChoice, boolean]> {
	// second value is if the player can 'see' the intent
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
	// Players get to choose the move/targets from valid set
	return {
		move: entity.moves[0],
		targets: emptyTargets(),
	};
}

function aiChoice (
	entity: CombatEntity
): TurnChoice {
	// TODO: Create AI Choice Logic
	// We will need some AI Profiles, with weights attached to types of actions
	// ideally, ai will have access to knowledge and have the ability to use said knowledge in choices
	// example: if an enemy is attuned to an element the ai has advantage over per on of their moves, their actions should reflect this (proportunate to IQ)
	return {
		move: entity.moves[0],
		targets: emptyTargets(),
	};
}
