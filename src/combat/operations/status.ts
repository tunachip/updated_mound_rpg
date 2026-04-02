// src/combat/operations/status.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function applyStatusTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const status = ctx.status;
	const amount = ctx.amount;
	if (!status) throw new Error("Required Field 'Status' Not Provided in CTX.");
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
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
	const status = ctx.status;
	const amount = ctx.amount;
	if (!status) throw new Error("Required Field 'Status' Not Provided in CTX.");
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");

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
	const status = ctx.status;
	const amount = ctx.amount;
	if (!status) throw new Error("Required Field 'Status' Not Provided in CTX.");
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
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
	const status = ctx.status;
	if (!status) throw new Error("Required Field 'Status' Not Provided in CTX.");
	
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
