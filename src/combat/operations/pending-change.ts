// src/combat/operations/pending-change.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function cancelPendingChange(
	ctx: OperationContext,
): Array<StateChange> {
	requireCtx('cancelPendingChange', ctx, ['listenerContext']);
	ctx.listenerContext.cancel = true;
	return [];
}

export function setPendingChangeAfter(
	ctx: OperationContext,
): Array<StateChange> {
	requireCtx('setPendingChangeAfter', ctx, ['listenerContext', 'amount']);
	ctx.listenerContext.change.after = ctx.amount;
	return [];
}
