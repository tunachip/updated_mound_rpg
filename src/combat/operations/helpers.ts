// src/combat/operations/helpers.ts

import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type {
	Listener,
	ListenerCondition,
	MoveMetadataField,
	Operation,
	OperationContext,
	OperationHandler,
	TargetMatrix,
	TargetResolver,
} from './types.ts';

export function randomNumber(
	min: number,
	max: number,
): number {
	return Math.floor(Math.random() * (max - min)) + min;
}

export function requireCtx<K extends keyof OperationContext>(
	operation: string,
	ctx: OperationContext,
	keys: readonly K[],
): asserts ctx is OperationContext & Required<Pick<OperationContext, K>> {
	const missing = keys.filter((key) => ctx[key] == null);
	if (missing.length > 0) {
		let errorMessage = `'${operation}' Failed.\n\nMissing CTX Attributes:\n`;
		for (const key of missing) errorMessage += `\t'${String(key)}'\n`;
		throw new Error(errorMessage);
	}
}

export function emptyTargets(
): TargetMatrix {
	return {
		entities: [],
		moves: [],
		blessings: [],
	};
}

export function makeTargets({
	entities = [],
	moves = [],
	blessings = [],
}: Partial<TargetMatrix> = {}): TargetMatrix {
	return {
		entities: [...entities],
		moves: [...moves],
		blessings: [...blessings],
	};
}

export function selectedTargets(
): TargetResolver {
	return (ctx) => ctx.targets;
}

export function selfTargets(
): TargetResolver {
	return (ctx) => makeTargets({ entities: [ctx.caster] });
}

export function ownerTargets(
): TargetResolver {
	return (ctx) => {
		const owner = ctx.blessing?.owner ?? ctx.caster;
		return makeTargets({ entities: [owner] });
	};
}

export function selfBlessingTargets(
): TargetResolver {
	return (ctx) => ctx.blessing
		? makeTargets({ blessings: [ctx.blessing] })
		: emptyTargets();
}

export function hostTargets(
): TargetResolver {
	return (ctx) => {
		const change = ctx.change;
		if (!change) {
			return emptyTargets();
		}
		switch (true) {
			case 'entityType' in change.host:
				return makeTargets({ entities: [change.host] });
			case 'moveType' in change.host:
				return makeTargets({ moves: [change.host] });
			case 'turn' in change.host:
				return emptyTargets();
			default:
				return makeTargets({ blessings: [change.host] });
		};
	}
}

export function entityTargets(
	...entities: Array<CombatEntity>
): TargetMatrix {
	return makeTargets({ entities });
}

export function moveTargets(
	...moves: Array<CombatMove>
): TargetMatrix {
	return makeTargets({ moves });
}

export function blessingTargets(
	...blessings: Array<CombatBlessing>
): TargetMatrix {
	return makeTargets({ blessings });
}

export function operation(
	handler: OperationHandler,
	options: {
		name?: string;
		ctx?: Operation['ctx'];
		targets?: TargetResolver;
		breaks?: boolean;
	} = {},
): Operation {
	return {
		name: options.name ?? handler.name ?? 'anonymousOperation',
		handler,
		ctx: options.ctx,
		resolveTargets: options.targets,
		breaks: options.breaks ?? false,
	};
}

export function moveMetadata(
	field: MoveMetadataField['moveMetadata'],
): MoveMetadataField {
	return { moveMetadata: field };
}

export function listener(options: {
	id?: string;
	phase: Listener['phase'];
	trigger: Listener['trigger'];
	conditions?: Array<ListenerCondition>;
	operations: Array<Operation>;
}): Listener {
	return {
		id: options.id ?? `${options.phase}:${options.trigger}`,
		phase: options.phase,
		trigger: options.trigger,
		conditions: options.conditions ?? [],
		operations: options.operations,
	};
}

export function changeHostIsOwner(
): ListenerCondition {
	return (ctx) => 'id' in ctx.change.host && ctx.change.host.id === ctx.owner.id;
}

export function changeAfterAtMost(
	threshold: number
): ListenerCondition {
	return (ctx) => typeof ctx.change.after === 'number' && ctx.change.after <= threshold;
}

export function changeAfterIs(
	value: unknown,
): ListenerCondition {
	return (ctx) => Object.is(ctx.change.after, value);
}

export function changeAfterGreaterThanBefore(
): ListenerCondition {
	return (ctx) =>
		typeof ctx.change.before === 'number' &&
		typeof ctx.change.after === 'number' &&
		ctx.change.after > ctx.change.before;
}

export function changeAfterLessThanBefore(
): ListenerCondition {
	return (ctx) =>
		typeof ctx.change.before === 'number' &&
		typeof ctx.change.after === 'number' &&
		ctx.change.after < ctx.change.before;
}
