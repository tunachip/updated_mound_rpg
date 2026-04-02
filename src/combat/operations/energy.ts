// src/combat/operations/energy.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function applyEnergy (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
	for (const target of ctx.targets.entities) {
		const before = target.energy;
		const max = target.maxEnergy;
		if (before < max) {
			intents.push({
				host: target,
				field: ['energy'],
				before: before,
				after: Math.min(max, before + amount),
			});
		}
	}
	return intents;
}

export function reduceEnergy (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
	for (const target of ctx.targets.entities) {
		const before = target.energy;
		if (before > 0) {
			intents.push({
				host: target,
				field: ['energy'],
				before: before,
				after: Math.max(0, before - amount),
			});
		}
	}
	return intents;
}

export function extendEnergy (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");
	
	for (const target of ctx.targets.entities) {
		const before = target.energy;
		const max = target.maxEnergy;
		if (before > 0 && before < max) {
			intents.push({
				host: target,
				field: ['energy'],
				before: before,
				after: Math.min(max, before + amount),
			});
		}
	}
	return intents;
}

export function negateEnergy (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	
	for (const target of ctx.targets.entities) {
		if (target.energy > 0) {
			intents.push({
				host: target,
				field: ['energy'],
				before: target.energy,
				after: 0,
			});
		}
	}
	return intents;
}
