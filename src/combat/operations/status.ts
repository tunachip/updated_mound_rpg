// src/combat/operations/status.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyStatusTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyStatusTurns', ctx, ['status', 'amount']);
	const { status, amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.statusTurns[status];
		const max = target.statusMaxTurns[status];
		if (before < max) {
			intents.push({
				host: target,
				field: ['statusTurns', status],
				before: before,
				after: Math.min(max, before + amount),
			});
		}
		if (target.hasStatus[status] === false) {
			intents.push({
				host: target,
				field: ['hasStatus', status],
				before: false,
				after: true,
			});
		}
	}
	return intents;
}

export function reduceStatusTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('reduceStatusTurns', ctx, ['status', 'amount']);
	const { status, amount } = ctx;

	for (const target of ctx.targets.entities) {
		const before = target.statusTurns[status];
		const after = Math.max(0, before - amount);
		if (before > 0) {
			intents.push({
				host: target,
				field: ['statusTurns', status],
				before: before,
				after: after,
			});
		}
		if (after === 0 && target.hasStatus[status] === true) {
			intents.push({
				host: target,
				field: ['hasStatus', status],
				before: true,
				after: false,
			});
		}
	}
	return intents;
}

export function extendStatusTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('extendStatusTurns', ctx, ['status', 'amount']);
	const { status, amount } = ctx;
	
	for (const target of ctx.targets.entities) {
		const before = target.statusTurns[status];
		const max = target.statusMaxTurns[status];
		if (before > 0) {
			intents.push({
				host: target,
				field: ['statusTurns', status],
				before: before,
				after: Math.min(max, before + amount),
			});
		}
		if (target.hasStatus[status] === false) {
			intents.push({
				host: target,
				field: ['hasStatus', status],
				before: false,
				after: true,
			});
		}
	}
	return intents;
}

export function negateStatus (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('negateStatus', ctx, ['status']);
	const { status } = ctx;
	
	for (const target of ctx.targets.entities) {
		if (target.hasStatus[status] === true) {
			intents.push({
				host: target,
				field: ['hasStatus', status],
				before: true,
				after: false,
			});
			intents.push({
				host: target,
				field: ['statusTurns', status],
				before: target.statusTurns[status],
				after: 0,
			});
		}
	}
	return intents;
}

export function applyIgnoreStatusTurns(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyIgnoreStatusTurns', ctx, ['status', 'amount']);
	const { status, amount } = ctx;

	for (const target of ctx.targets.entities) {
		const before = target.ignoresStatusTurns[status];
		intents.push({
			host: target,
			field: ['ignoresStatusTurns', status],
			before,
			after: before + amount,
		});
	}

	return intents;
}
