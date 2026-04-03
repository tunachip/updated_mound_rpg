// src/combat/operations/if-then-else.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { getStateChangeSignal } from './diff.ts';
import { previewOperations } from './resolver.ts';
import { requireCtx } from './helpers.ts';

function signalWasEmitted(
	ctx: OperationContext,
): boolean {
	requireCtx('signalWasEmitted', ctx, ['signal']);
	const changes = ctx.changes ?? [];
	return changes.some(
		(change) =>
			change.signal === ctx.signal ||
			getStateChangeSignal(change) === ctx.signal,
	);
}

export function ifThenElse(
	ctx: OperationContext
): Array<StateChange> {
	requireCtx('ifThenElse', ctx, ['signal', 'operations']);

	const branch = signalWasEmitted(ctx)
		? ctx.operations
		: (ctx.elseOperations ?? []);
	if (branch.length === 0) {
		return [];
	}

	const previewSequence = previewOperations(branch, ctx);
	return previewSequence[previewSequence.length - 1] ?? [];
}
