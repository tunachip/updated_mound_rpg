// src/combat/operations/helpers.ts

import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type {
	Listener,
	ListenerCondition,
	ListenerHandler,
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
		for (const key of missing) {
			errorMessage += `\t'${String(key)}'\n`;
		}
		throw new Error(errorMessage);
	}
}

export function emptyTargets(): TargetMatrix {
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

export function selectedTargets(): TargetResolver {
	return (ctx) => ctx.targets;
}

export function selfTargets(): TargetResolver {
	return (ctx) => makeTargets({ entities: [ctx.caster] });
}

export function ownerTargets(): TargetResolver {
	return (ctx) => {
		const owner = ctx.blessing?.owner ?? ctx.caster;
		return makeTargets({ entities: [owner] });
	};
}

export function hostTargets(): TargetResolver {
	return (ctx) => {
		const change = ctx.change;
		if (!change) {
			return emptyTargets();
		}
		if ('entityType' in change.host) {
			return makeTargets({ entities: [change.host] });
		}
		if ('moveType' in change.host) {
			return makeTargets({ moves: [change.host] });
		}
		return makeTargets({ blessings: [change.host] });
	};
}

export function entityTargets(...entities: Array<CombatEntity>): TargetMatrix {
	return makeTargets({ entities });
}

export function moveTargets(...moves: Array<CombatMove>): TargetMatrix {
	return makeTargets({ moves });
}

export function blessingTargets(...blessings: Array<CombatBlessing>): TargetMatrix {
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

export function listener(options: {
	id?: string;
	phase: Listener['phase'];
	trigger: Listener['trigger'];
	conditions?: Array<ListenerCondition>;
	handler: ListenerHandler;
}): Listener {
	return {
		id: options.id ?? `${options.phase}:${options.trigger}`,
		phase: options.phase,
		trigger: options.trigger,
		conditions: options.conditions ?? [],
		handler: options.handler,
	};
}

export function changeHostIsOwner(): ListenerCondition {
	return (ctx) => ctx.change.host.id === ctx.owner.id;
}

export function changeAfterAtMost(threshold: number): ListenerCondition {
	return (ctx) => typeof ctx.change.after === 'number' && ctx.change.after <= threshold;
}
