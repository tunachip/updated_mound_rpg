// src/combat/operations/register-listener.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { requireCtx } from './helpers.ts';

export function registerListener(
	ctx: OperationContext
): Array<StateChange> {
	requireCtx('registerListener', ctx, ['listeners']);

	const owners = ctx.targets.entities.length > 0
		? ctx.targets.entities
		: [ctx.caster];

	return owners.flatMap((owner) =>
		ctx.listeners.map((listener) => ({
			host: ctx.move ?? ctx.blessing ?? owner,
			field: ['listeners', listener.id, owner.id],
			before: false,
			after: true,
			signal: `listener.registered.${listener.id}.${owner.id}`,
			apply: false,
			registeredListener: {
				owner,
				move: ctx.move ?? null,
				blessing: ctx.blessing ?? null,
				listener,
				chargeTurns: listener.chargeTurns,
			},
		})),
	);
}
