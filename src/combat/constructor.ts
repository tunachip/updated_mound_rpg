// src/combat/constructor.ts

import type { CombatState } from '.';
import type { EntityTemplate } from '../data/templates';
import { buildCombatEntities } from './models/constructor.ts';
import { randomNumber } from './operations';

export function buildCombatState(
	party: Array<EntityTemplate>,
	encounters: Array<EntityTemplate>,
): CombatState {
	return {
		turn: 0,
		hasPriority: (['party', 'encounters'] as const)[randomNumber(0, 2)],
		entities: {
			encounters: buildCombatEntities(encounters),
			party: buildCombatEntities(party),
		},
		listeners: [],
		eventLog: [],
	};
}
