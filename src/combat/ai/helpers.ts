// src/combat/ai/helpers.ts

import type { CombatEntity } from "../models";
import type { CombatState } from "../types";
import type { CombatTeam } from "../../shared";

export function teamOfEntity(
	combat: CombatState,
	entity: CombatEntity,
): CombatTeam | null {
	const entities = combat.entities;
	switch (true) {
		case (entities.party.some((member) => member.id === entity.id)):
			return 'party';
		case (entities.encounters.some((member) => member.id === entity.id)):
			return 'encounters';
		default:
			return null;
	}
}

export function alliesOf(
	combat: CombatState,
	entity: CombatEntity,
): Array<CombatEntity> {
	const team = teamOfEntity(combat, entity);
	if (!team) return [];
	return combat.entities[team].filter(
		(candidate) => !candidate.isDead);
}

export function enemiesOf(
	combat: CombatState,
	entity: CombatEntity,
): Array<CombatEntity> {
	const team = teamOfEntity(combat, entity);
	if (!team) return [];
	const enemyTeam = team === 'party' ? 'encounters' : 'party';
	return combat.entities[enemyTeam].filter(
		(candidate) => !candidate.isDead);
}

export function resolveFieldValue(
	entity: CombatEntity,
	field: Array<string>
): any {
	let out = entity;
	for (let index = 0; index < field.length; index += 1) {
		out = out[field[index]];
	}
	return out;
}

export function goalSatisfied (
	current: any,
	desired: any,
	goalType: 'maintain' | 'approach' | 'prevent',
): boolean {
	switch (goalType) {
		case 'maintain':
		case 'approach':
			return (current === desired);
		case 'prevent':
			return (current !== desired);
	}
}
