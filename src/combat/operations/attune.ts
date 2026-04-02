// src/combat/operations/attune.ts

import type { DamageElement } from '../../shared';
import type { EmitIntentStep, EntitySelector } from './types.ts';

export function createSetAttunementStep(
	target: EntitySelector,
	element: DamageElement,
	value = true,
): EmitIntentStep {
	return {
		kind: 'emit_intent',
		intent: {
			kind: 'set_attunement',
			target,
			element,
			value,
		},
	};
}
