// src/combat/operations/cooldown.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function applyCooldownTurns (
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyCooldownTurns', ctx, ['amount']);
	const { amount } = ctx;

	for (const target of [
		...ctx.targets.moves,
		...ctx.targets.blessings
	]) {
		const before = target.currentCooldownTurns;
		intents.push({
			host: target,
			field: ['currentCooldownTurns'],
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
	requireCtx('reduceCooldownTurns', ctx, ['amount']);
	const { amount } = ctx;

	for (const target of [
		...ctx.targets.moves,
		...ctx.targets.blessings
	]) {
		const before = target.currentCooldownTurns;
		intents.push({
			host: target,
			field: ['currentCooldownTurns'],
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
	requireCtx('extendCooldownTurns', ctx, ['amount']);
	const { amount } = ctx;

	for (const target of [
		...ctx.targets.moves,
		...ctx.targets.blessings
	]) {
		const before = target.currentCooldownTurns;
		if (before > 0) {
			intents.push({
				host: target,
				field: ['currentCooldownTurns'],
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

	for (const target of [
		...ctx.targets.moves,
		...ctx.targets.blessings
	]) {
		intents.push({
			host: target,
			field: ['currentCooldownTurns'],
			before: target.currentCooldownTurns,
			after: 0,
		});
	}
	return intents;
}
