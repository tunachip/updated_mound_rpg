// src/combat/operations/cooldown.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function applyCooldownTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");

	for (const target of [...ctx.targets.moves, ...ctx.targets.blessings]) {
		const before = target.cooldownTurns;
		intents.push({
			host: target,
			field: ['cooldownTurns'],
			before: before,
			after: before + amount,
		});
	}
	return intents;
}

export function reduceCooldownTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");

	for (const target of [...ctx.targets.moves, ...ctx.targets.blessings]) {
		const before = target.cooldownTurns;
		intents.push({
			host: target,
			field: ['cooldownTurns'],
			before: before,
			after: Math.max(0, before - amount),
		});
	}
	return intents;
}

export function extendCooldownTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const amount = ctx.amount;
	if (!amount) throw new Error("Required Field 'Amount' Not Provided in CTX.");

	for (const target of [...ctx.targets.moves, ...ctx.targets.blessings]) {
		const before = target.cooldownTurns;
		if (before > 0) {
			intents.push({
				host: target,
				field: ['cooldownTurns'],
				before: before,
				after: before + amount,
			});
		}
	}
	return intents;
}

export function negateCooldown (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of [...ctx.targets.moves, ...ctx.targets.blessings]) {
		intents.push({
			host: target,
			field: ['cooldownTurns'],
			before: target.cooldownTurns,
			after: 0,
		});
	}
	return intents;
}
