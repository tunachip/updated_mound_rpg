// src/combat/types.ts

import type { AiPredictionCache } from './ai/cache.ts';
import type { RegisteredRuntimeListener } from './operations';
import type { CombatEntity } from './models';

export interface EntityMatrix {
	encounters: Array<CombatEntity>;
	party: Array<CombatEntity>;
}

export interface CombatState {
	turn: number;
	hasPriority: 'party' | 'encounters';
	entities: EntityMatrix;
	listeners: Array<RegisteredRuntimeListener>;
	eventLog: Array<string>;
	aiCache: AiPredictionCache | null;
}
