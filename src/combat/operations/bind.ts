import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';

export function bindMoves(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of [
		...ctx.targets.moves,
		...ctx.targets.blessings,
	]) {
		if (target.isBound) {
			continue;
		}
		intents.push({
			host: target,
			field: ['isBound'],
			before: false,
			after: true,
		});
	}

	return intents;
}

export function releaseMoves(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of [
		...ctx.targets.moves,
		...ctx.targets.blessings,
	]) {
		if (!target.isBound) {
			continue;
		}
		intents.push({
			host: target,
			field: ['isBound'],
			before: true,
			after: false,
		});
	}

	return intents;
}
