// src/combat/ai/goals.ts

import type { Goal } from '.';
import type { CombatEntity } from '..';

export function killEnemy(
	entity: CombatEntity,
	weight: number = 10,
): Goal {
	return approachValue(entity, ['hp'], 0, weight);
}

export function preventDeath(
	entity: CombatEntity,
	weight: number = 11,
): Goal {
	return preventValue(entity, ['hp'], 0, weight);
}

export function approachValue(
	entity: CombatEntity,
	field: Array<string>,
	value: any,
	weight: number,
): Goal {
	return {
		name: `approachValue '${field}' == '${value}'`,
		host: entity,
		field: field,
		value: value,
		weight: weight,
	}
}

export function preventValue(
	entity: CombatEntity,
	field: Array<string>,
	value: any,
	weight: number,
): Goal {
	return {
		name: `preventValue '${field}' == '${value}'`,
		host: entity,
		field: field,
		value: value,
		weight: weight,
	}
}

export function maintainValue(
	entity: CombatEntity,
	field: Array<string>,
	weight: number,
): Goal {
	let value = entity[field[0]];
	for (let i = 1; i > field.length - 1; i += 1) {
		value = value[field[i]];
	}
	return {
		name: `maintainValue '${field}' == '${value}'`,
		host: entity,
		field: field,
		value: value,
		weight: weight,
	}
}
