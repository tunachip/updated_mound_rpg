import {
	applyStatusTurns,
	changeHostIsOwner,
	listener,
	operation,
	ownerTargets,
	registerListener,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: applies 2 strong to any target, then registers a listener
// this listener lasts 2 turns (using the count introduced earlier)
// listener states: when taking damage, apply 1 wound to self

export const ApplyStrong = createBasicUtilityMove({
	id: 'move_apply_strong',
	name: 'Apply Strong',
	description: 'Apply 2 strong to 1 entity and add a 2-turn wound-on-hit listener.',
	element: 'vital',
	targetType: {
		type: 'entity',
		range: [1, 1],
	},
	operations: [
		operation(applyStatusTurns, {
			ctx: { status: 'strong', amount: 2 },
		}),
		operation(registerListener, {
			ctx: {
				listeners: [
					listener({
						id: 'move_apply_strong:on_damage',
						phase: 'sideEffect',
						trigger: 'entity.hp',
						chargeTurns: 2,
						conditions: [
							changeHostIsOwner(),
							(ctx) =>
								typeof ctx.change.before === 'number' &&
								typeof ctx.change.after === 'number' &&
								ctx.change.after < ctx.change.before,
						],
						operations: [
							operation(applyStatusTurns, {
								ctx: { status: 'wound', amount: 1 },
								targets: ownerTargets(),
							}),
						],
					}),
				],
			},
		}),
	],
});
