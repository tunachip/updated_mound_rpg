// src/combat/operations/register-listener.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function registerListener(
	ctx: OperationContext
): Array<StateChange> {
	requireCtx('registerListener', ctx, ['listeners']);

	const host = ctx.move ?? ctx.blessing ?? ctx.caster;
	return ctx.listeners.map((listener) => ({
		host: host,
		field: ['listeners', listener.id],
		before: false,
		after: true,
		signal: `listener.registered.${listener.id}`,
		apply: false,
		registeredListener: {
			owner: ctx.caster,
			move: ctx.move ?? null,
			blessing: ctx.blessing ?? null,
			listener: listener,
		},
	}));
}
