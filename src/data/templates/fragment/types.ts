// src/data/templates/fragment/types.ts

import type { DamageElement, Status, ModifierExpression } from '../../../shared';
import type { Operation } from '../../../combat/operations';

export interface FragmentTemplate {
	id: string;
	name: string;
	description: string;
	element?: DamageElement;
	baseDamage?: [ModifierExpression, number];
	baseIterations?: [ModifierExpression, number];
	ignoresStatuses?: [ModifierExpression, Array<Status>];
	operations?: Array<[ModifierExpression, Operation]>;
}
