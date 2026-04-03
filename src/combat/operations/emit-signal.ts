// src/combat/operations/emit-signal.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function emitSignal(
	ctx: OperationContext
): Array<StateChange> {
	requireCtx('emitSignal', ctx, ['signal']);

	const host = ctx.move ?? ctx.blessing ?? ctx.caster;
	return [{
		host,
		field: ['signals', ctx.signal],
		before: false,
		after: true,
		signal: ctx.signal,
		apply: false,
	}];
}
