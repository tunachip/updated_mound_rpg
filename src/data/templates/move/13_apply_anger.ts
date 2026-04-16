import {
	applyStatusTurns,
	changeHostIsOwner,
	listener,
	operation,
	ownerTargets,
	registerListener,
	selfTargets,
} from '../../../combat/operations/index.ts';
import { createBasicUtilityMove } from './basic-utility.ts';

// Update: register a listener where taking fire damage entity gains 1 turn of anger
// this listener lasts for 3 turns, which we can represent with a 'chargeTurns' count we are adding to listeners.
// we will update the listener turn logic so that listeners count down at the end of turn.
// we will create an audit array, just like with cooldowns, to manage this.
// -1 will be the numeric representation for listeners that are perpetual, just like cooldown, but this is perpetually being 'on'
// afterwards, applies this same listener to the caster

export const ApplyAnger = createBasicUtilityMove({
	id: 'move_apply_anger',
	name: 'Apply Anger',
	description: 'Grant a 3-turn fire-rage listener to 1 entity and self.',
	element: 'fire',
	targetType: {
		type: 'entity',
		range: [1, 1],
	},
	operations: [
		operation(registerListener, {
			ctx: {
				listeners: [
					listener({
						id: 'move_apply_anger:on_fire_damage',
						phase: 'sideEffect',
						trigger: 'entity.hp',
						chargeTurns: 3,
						conditions: [
							changeHostIsOwner(),
							(ctx) =>
								typeof ctx.change.before === 'number' &&
								typeof ctx.change.after === 'number' &&
								ctx.change.after < ctx.change.before &&
								ctx.move?.element === 'fire',
						],
						operations: [
							operation(applyStatusTurns, {
								ctx: { status: 'anger', amount: 1 },
								targets: ownerTargets(),
							}),
						],
					}),
				],
			},
		}),
		operation(registerListener, {
			ctx: {
				listeners: [
					listener({
						id: 'move_apply_anger:on_fire_damage',
						phase: 'sideEffect',
						trigger: 'entity.hp',
						chargeTurns: 3,
						conditions: [
							changeHostIsOwner(),
							(ctx) =>
								typeof ctx.change.before === 'number' &&
								typeof ctx.change.after === 'number' &&
								ctx.change.after < ctx.change.before &&
								ctx.move?.element === 'fire',
						],
						operations: [
							operation(applyStatusTurns, {
								ctx: { status: 'anger', amount: 1 },
								targets: ownerTargets(),
							}),
						],
					}),
				],
			},
			targets: selfTargets(),
		}),
	],
});
