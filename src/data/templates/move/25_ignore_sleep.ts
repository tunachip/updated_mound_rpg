import { applyIgnoreStatusTurns, operation } from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

export const IgnoreSleep = createBasicUtilityMove({
	id: 'move_ignore_sleep',
	name: 'Ignore Sleep',
	description: 'Grant 1 turn of sleep immunity to 1 ally.',
	element: 'vital',
	targetType: {
		type: 'ally',
		range: [1, 1],
	},
	operations: [
		operation(applyIgnoreStatusTurns, {
			ctx: { status: 'sleep', amount: 1 },
		}),
	],
});
