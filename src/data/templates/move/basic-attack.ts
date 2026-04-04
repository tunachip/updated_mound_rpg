// src/data/templates/move/basic-attack.ts

import type { DamageElement } from '../../../shared';
import type { MoveTemplate } from './types.ts';
import { applyAttunement, attack, loop, moveMetadata, operation, selfTargets } from '../../../combat/operations/index.ts';

export function createBasicAttackMove(
	id: string,
	name: string,
	element: DamageElement,
): MoveTemplate {
	return {
		id,
		name,
		description: `Caster attunes to ${element}. Deal ${2} ${element} damage to target.`,
		moveType: 'attack',
		element,
		targetType: {
			type: 'enemy',
			range: [1, 1],
		},
		baseDamage: 2,
		baseIterations: 1,
		ignoresStatuses: [],
		operations: [
			operation(applyAttunement, {
				ctx: { element: moveMetadata('element') },
				targets: selfTargets(),
			}),
			operation(loop),
		],
		loopOperations: [
			operation(attack, {
				ctx: {
					element: moveMetadata('element'),
					amount: moveMetadata('baseDamage'),
				},
			}),
		],
	};
}
