// src/data/templates/blessings/types.ts

import type { DamageElement } from '../../../shared';
import type { BlessingListener } from '../../../combat/operations';

export interface BlessingTemplate {
	id: string;
	name: string;
	description: string;
	element: DamageElement;
	cooldownTurns: number;
	isBound: boolean;
	listeners: Array<BlessingListener>;
}
