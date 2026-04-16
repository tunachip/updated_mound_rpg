// src/combat/constructor.ts

import type { CombatState } from '.';
import type { EntityTemplate } from '../data/templates';
import { buildCombatEntities } from './models/constructor.ts';
import { hydrateCombatGoals } from './ai/goals.ts';
import { hydrateAiGoalListeners } from './ai/listeners.ts';
import { randomNumber } from './operations/index.ts';

export function buildCombatState(
	party: Array<EntityTemplate>,
	encounters: Array<EntityTemplate>,
): CombatState {
	const combat: CombatState = {
		turn: 0,
		hasPriority: (['party', 'encounters'] as const)[randomNumber(0, 2)],
		entities: {
			encounters: buildCombatEntities(encounters),
			party: buildCombatEntities(party),
		},
		listeners: [],
		eventLog: [],
		aiCache: null,
	};
	hydrateCombatGoals(combat);
	hydrateAiGoalListeners(combat);
	return combat;
}
