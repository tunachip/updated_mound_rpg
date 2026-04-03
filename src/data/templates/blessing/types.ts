// src/data/templates/blessings/types.ts

import type { DamageElement } from '../../../shared';
import type { Listener } from '../../../combat/operations';

export interface BlessingTemplate {
	id: string;
	name: string;
	description: string;
	element: DamageElement;
	isBound: boolean;
	listeners: Array<Listener>;
}
