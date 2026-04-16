import { applyIgnoreStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: applies 2 turns of sleep immunity to self. this move is itself sleep-proof

export const IgnoreSleep = createBasicUtilityMove({
	id: 'move_ignore_sleep',
	name: 'Ignore Sleep',
	description: 'Grant 2 turns of sleep immunity to self.',
	element: 'vital',
	targetType: {
		type: 'self',
		range: [1, 1],
	},
	ignoresStatuses: ['sleep'],
	operations: [
		operation(applyIgnoreStatusTurns, {
			ctx: { status: 'sleep', amount: 2 },
		}),
	],
});
