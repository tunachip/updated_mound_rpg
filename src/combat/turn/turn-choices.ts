// src/combat/turn/turn-choices.ts

import type { TurnChoice, CombatEntity } from '../models';
import type { CombatState } from '../types.ts';
import {
	calculateAllTurnChoicesInWorkers,
	calculateAllTurnChoices,
	calculateTurnChoices,
} from '../ai/index.ts';

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

export function makeAllTurnChoices(
	combat: CombatState,
): Map<string, Array<[TurnChoice, boolean]>> {
	const calculated = calculateAllTurnChoices(combat);
	const allChoices = new Map<string, Array<[TurnChoice, boolean]>>();

	for (const entity of [
		...combat.entities.encounters,
		...combat.entities.party,
	]) {
		const choices = calculated.get(entity.id) ?? [];
		switch (entity.entityType) {
			case 'controlled':
				allChoices.set(entity.id, choices[0] ? [[choices[0], true]] : []);
				break;
			case 'forecasted':
				allChoices.set(
					entity.id,
					choices.map((choice) => [choice, true]),
				);
				break;
			case 'hidden':
				allChoices.set(
					entity.id,
					choices.map((choice) => [choice, false]),
				);
				break;
		}
	}

	return allChoices;
}

export async function makeAllTurnChoicesInWorkers(
	combat: CombatState,
): Promise<Map<string, Array<[TurnChoice, boolean]>>> {
	const calculated = await calculateAllTurnChoicesInWorkers(combat);
	const allChoices = new Map<string, Array<[TurnChoice, boolean]>>();

	for (const entity of [
		...combat.entities.encounters,
		...combat.entities.party,
	]) {
		const choices = calculated.get(entity.id) ?? [];
		switch (entity.entityType) {
			case 'controlled':
				allChoices.set(entity.id, choices[0] ? [[choices[0], true]] : []);
				break;
			case 'forecasted':
				allChoices.set(
					entity.id,
					choices.map((choice) => [choice, true]),
				);
				break;
			case 'hidden':
				allChoices.set(
					entity.id,
					choices.map((choice) => [choice, false]),
				);
				break;
		}
	}

	return allChoices;
}
