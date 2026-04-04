// src/combat/operations/tick.ts

import type { DamageElement, Status } from '../../shared';
import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { applyDamageFromStatus } from './damage.ts';
import { applyEnergy } from './energy.ts';
import { heal } from './heal.ts';
import { applyShields } from './shield.ts';
import { applyStatusTurns, reduceStatusTurns } from './status.ts';
import { requireCtx } from './helpers.ts';

function statusTargets(
	ctx: OperationContext,
	status: Status,
): OperationContext {
	const statusedEntities = ctx.targets.entities.filter(
		(target) => target.hasStatus[status]);
	return {
		...ctx,
		status,
		targets: {
			entities: statusedEntities,
			moves: [],
			blessings: [],
		},
	};
}

export function tickStatus(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('tickStatus', ctx, ['status', 'amount']);
	const activeCtx = statusTargets(ctx, ctx.status);

	if (activeCtx.targets.entities.length === 0) {
		return intents;
	}

	switch (ctx.status) {
		case 'burn':
		case 'decay':
			intents.push(...applyDamageFromStatus(activeCtx));
			break;
		case 'wound':
			return intents;
		case 'regen':
			intents.push(...heal(activeCtx));
			break;
		case 'focus':
			intents.push(...applyEnergy(activeCtx));
			break;
		case 'tough':
			intents.push(...applyShields(activeCtx));
			break;
		case 'sleep':
			intents.push(...heal(activeCtx));
			intents.push(...applyEnergy(activeCtx));
			break;
		case 'sick':
			for (const target of activeCtx.targets.entities) {
				const sicknesses = ['burn', 'decay', 'wound', 'curse'] as const;
				for (const sickness of sicknesses) {
					if (!target.hasStatus[sickness]) {
						continue;
					}
					intents.push(
						...applyStatusTurns({
							...ctx,
							status: sickness,
							targets: {
								entities: [target],
								moves: [],
								blessings: [],
							},
						}),
					);
				}
			}
			break;
	}
	intents.push(...reduceStatusTurns(activeCtx));
	return intents;
}

export function tickAttunementTurns(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('tickAttunementTurns', ctx, ['element', 'amount']);

	for (const target of ctx.targets.entities) {
		if (!target.attunedTo[ctx.element]) {
			continue;
		}
		intents.push({
			host: target,
			field: ['turnsAttuned', ctx.element],
			before: target.turnsAttuned[ctx.element],
			after: target.turnsAttuned[ctx.element] + ctx.amount,
		});
	}
	return intents;
}

export function tickIgnoreStatusTurns(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('tickIgnoreStatusTurns', ctx, ['status', 'amount']);

	for (const target of ctx.targets.entities) {
		const before = target.ignoresStatusTurns[ctx.status];
		if (before <= 0) {
			continue;
		}
		intents.push({
			host: target,
			field: ['ignoresStatusTurns', ctx.status],
			before,
			after: Math.max(0, before - ctx.amount),
		});
	}
	return intents;
}

export function tickAllAttunementTurns(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('tickAllAttunementTurns', ctx, ['amount']);

	for (const element of Object.keys(ctx.caster.attunedTo) as Array<DamageElement>) {
		intents.push(...tickAttunementTurns({ ...ctx, element }));
	}
	return intents;
}
