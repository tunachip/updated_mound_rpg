// src/combat/operations/diff.ts

import type { CombatEntity, CombatMove, CombatBlessing } from '../models';

export interface StateChange {
	host: CombatEntity | CombatMove | CombatBlessing;
	field: Array<string>;
	before: any;
	after: any;
}
