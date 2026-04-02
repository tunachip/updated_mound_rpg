// src/combat/operations/curse-chance.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from './index.ts';

export function applyCurseChance (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");

	for (const target of ctx.targets.entities) {
		const before = target.curseChance;
		intents.push({
			host: target,
			field: ['curseChance'],
			before: before,
			after: before + amount,
		});
	}
	return intents;
}

export function reduceCurseChance (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");

	for (const target of ctx.targets.entities) {
		const before = target.curseChance;
		intents.push({
			host: target,
			field: ['curseChance'],
			before: before,
			after: Math.max(0, before - amount),
		});
	}
	return intents;
}

export function extendCurseChance (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");

	for (const target of ctx.targets.entities) {
		const before = target.curseChance;
		if (before > 0) {
			intents.push({
				host: target,
				field: ['curseChance'],
				before: before,
				after: before + amount,
			});
		}
	}
	return intents;
}

export function negateCurseChance (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.entities) {
		intents.push({
			host: target,
			field: ['curseChance'],
			before: target.curseChance,
			after: 0,
		});
	}
	return intents;
}
