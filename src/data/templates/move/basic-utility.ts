import type { DamageElement } from '../../../shared';
import type { Operation } from '../../../combat/operations';
import type { MoveTemplate } from './types.ts';

export function createBasicUtilityMove(options: {
	id: string;
	name: string;
	description: string;
	element: DamageElement;
	targetType: MoveTemplate['targetType'];
	operations: Array<Operation>;
	loopOperations?: Array<Operation>;
	ignoresStatuses?: MoveTemplate['ignoresStatuses'];
}): MoveTemplate {
	return {
		id: options.id,
		name: options.name,
		description: options.description,
		moveType: 'utility',
		targetType: options.targetType,
		element: options.element,
		baseDamage: 0,
		baseIterations: 1,
		ignoresStatuses: options.ignoresStatuses ?? [],
		operations: options.operations,
		loopOperations: options.loopOperations ?? [],
	};
}
