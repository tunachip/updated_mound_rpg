// src/combat/operations/resolver.ts

import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';
import {
	applyStateChange, applyStateChanges,
	getStateChangeSignal, isNoopStateChange,
	mergeStateChanges, type StateChange
} from './diff.ts';
import { emptyTargets } from './helpers.ts';
import type {
	Listener, ListenerContext,
	Operation, OperationContext,
	OperationResult, PreviewSequence,
	RegisteredRuntimeListener, ResolutionResult
} from './types.ts';


function resolveOperationContext(
	operation: Operation,
	baseCtx: OperationContext,
): OperationContext {
	const resolvedTargets = operation.resolveTargets
		? operation.resolveTargets(baseCtx)
		: baseCtx.targets;

	return {
		...baseCtx,
		...(operation.ctx ?? {}),
		targets: resolvedTargets,
	};
}

function createListenerContext(
	combat: CombatState,
	owner: CombatEntity,
	blessing: CombatBlessing | null,
	change: StateChange,
	move: CombatMove | null,
): ListenerContext {
	return {
		combat,
		owner,
		blessing,
		change,
		move,
		cancel: false,
		breakSequence: false,
		sideEffects: [],
	};
}

function matchingListeners(
	combat: CombatState,
	phase: Listener['phase'],
	change: StateChange,
	move: CombatMove | null,
): Array<RegisteredRuntimeListener> {
	const trigger = getStateChangeSignal(change);
	return combat.listeners.filter((registered) =>
		registered.listener.phase === phase &&
		registered.listener.trigger === trigger &&
		registered.listener.conditions.every((condition) =>
			condition(
				createListenerContext(
					combat,
					registered.owner,
					registered.blessing,
					change,
					move,
				),
			),
		),
	);
}

function resolveListenerType(
	combat: CombatState,
	phase: Listener['phase'],
	change: StateChange,
	move: CombatMove | null,
): {
	updatedChange: StateChange;
	cancelled: boolean;
	sideEffects: Array<StateChange>;
	breaks: boolean;
} {
	const pendingChange: StateChange = {
		host: change.host,
		field: [...change.field],
		before: change.before,
		after: change.after,
		signal: change.signal,
		apply: change.apply,
		registeredListener: change.registeredListener,
	};

	const sideEffects: Array<StateChange> = [];
	let cancelled = false;
	let breaks = false;

	for (const registered of matchingListeners(combat, phase, pendingChange, move)) {
		const ctx = createListenerContext(
			combat,
			registered.owner,
			registered.blessing,
			pendingChange,
			move,
		);
		registered.listener.handler(ctx);
		if (ctx.cancel) {
			cancelled = true;
		}
		if (ctx.breakSequence) {
			breaks = true;
		}
		sideEffects.push(...ctx.sideEffects);
	}

	return {
		updatedChange: pendingChange,
		cancelled,
		sideEffects,
		breaks,
	};
}

export function executeOperation(
	operation: Operation,
	baseCtx: OperationContext,
): OperationResult {
	const ctx = resolveOperationContext(operation, baseCtx);
	return {
		changes: mergeStateChanges(operation.handler(ctx)),
		breaks: operation.breaks ?? false,
	};
}

export function previewOperations(
	operations: Array<Operation>,
	baseCtx: OperationContext,
): PreviewSequence {
	const inheritedChanges = baseCtx.changes ?? [];
	const changes: Array<StateChange> = [];
	const sequence: PreviewSequence = [];
	const appliedForPreview: Array<StateChange> = [];

	try {
		for (const operation of operations) {
			const result = executeOperation(operation, {
				...baseCtx,
				changes: mergeStateChanges([
					...inheritedChanges,
					...changes,
				]),
			});
			changes.push(...result.changes);
			appliedForPreview.push(...applyStateChanges(result.changes));
			sequence.push(mergeStateChanges(changes));
			if (result.breaks) {
				break;
			}
		}
	} finally {
		for (const change of [...appliedForPreview].reverse()) {
			applyStateChange({
				host: change.host,
				field: [...change.field],
				before: change.after,
				after: change.before,
			});
		}
	}

	return sequence;
}

export function hydrateRuntimeListeners(
	combat: CombatState
): Array<RegisteredRuntimeListener> {
	const staticListeners: Array<RegisteredRuntimeListener> = [];
	const activeOwnerIds = new Set(
		[...combat.entities.party, ...combat.entities.encounters].map((entity) => entity.id),
	);

	for (const entity of [
		...combat.entities.party,
		...combat.entities.encounters
	]) {
		for (const blessing of entity.blessings) {
			if (blessing.isExhausted) {
				continue;
			}
			for (const listener of blessing.listeners) {
				staticListeners.push({
					owner: entity,
					move: null,
					blessing,
					listener,
				});
			}
		}
	}

	const dynamicListeners = combat.listeners.filter(
		(registered) =>
			activeOwnerIds.has(registered.owner.id) &&
			(registered.move !== null || registered.blessing === null),
	);

	combat.listeners = [...staticListeners, ...dynamicListeners];
	return combat.listeners;
}

export function resolveStateChange(
	combat: CombatState,
	change: StateChange,
	move: CombatMove | null,
): ResolutionResult {
	const interruptResult = resolveListenerType(combat, 'interrupt', change, move);
	const resolvedChanges: ResolutionResult = {
		applied: [],
		cancelled: [],
		breaks: interruptResult.breaks,
	};

	if (interruptResult.cancelled || isNoopStateChange(interruptResult.updatedChange)) {
		resolvedChanges.cancelled.push(interruptResult.updatedChange);
		const nested = resolveStateChanges(combat, interruptResult.sideEffects, move);
		resolvedChanges.applied.push(...nested.applied);
		resolvedChanges.cancelled.push(...nested.cancelled);
		resolvedChanges.breaks = resolvedChanges.breaks || nested.breaks;
		return resolvedChanges;
	}

	applyStateChange(interruptResult.updatedChange);
	if (
		interruptResult.updatedChange.host === combat &&
		interruptResult.updatedChange.field[0] === 'entities'
	) {
		hydrateRuntimeListeners(combat);
	}
	if (interruptResult.updatedChange.registeredListener) {
		combat.listeners.push(interruptResult.updatedChange.registeredListener);
	}
	resolvedChanges.applied.push(interruptResult.updatedChange);
	combat.eventLog.push(getStateChangeSignal(interruptResult.updatedChange));

	const sideEffectResult = resolveListenerType(combat, 'sideEffect', interruptResult.updatedChange, move,);
	resolvedChanges.breaks = resolvedChanges.breaks || sideEffectResult.breaks;
	if (sideEffectResult.cancelled) {
		resolvedChanges.cancelled.push(sideEffectResult.updatedChange);
	}

	const nested = resolveStateChanges(
		combat,
		[...interruptResult.sideEffects, ...sideEffectResult.sideEffects],
		move,
	);
	resolvedChanges.applied.push(...nested.applied);
	resolvedChanges.cancelled.push(...nested.cancelled);
	resolvedChanges.breaks = resolvedChanges.breaks || nested.breaks;
	return resolvedChanges;
}

export function resolveStateChanges(
	combat: CombatState,
	changes: Array<StateChange>,
	move: CombatMove | null,
): ResolutionResult {
	const parsedChanges: ResolutionResult = {
		applied: [],
		cancelled: [],
		breaks: false,
	};
	for (const change of mergeStateChanges(changes)) {
		const result = resolveStateChange(combat, change, move);
		parsedChanges.applied.push(...result.applied);
		parsedChanges.cancelled.push(...result.cancelled);
		parsedChanges.breaks = parsedChanges.breaks || result.breaks;
		if (parsedChanges.breaks) {
			break;
		}
	}
	return parsedChanges;
}

export function resolveOperations(
	combat: CombatState,
	operations: Array<Operation>,
	baseCtx: OperationContext,
): ResolutionResult {
	const inheritedChanges = baseCtx.changes ?? [];
	const emittedChanges: Array<StateChange> = [];
	const resolved: ResolutionResult = {
		applied: [],
		cancelled: [],
		breaks: false,
	};

	for (const operation of operations) {
		const result = executeOperation(operation, {
			...baseCtx,
			changes: mergeStateChanges([
				...inheritedChanges,
				...emittedChanges,
			]),
		});

		const resolution = resolveStateChanges(combat, result.changes, baseCtx.move);
		emittedChanges.push(
			...result.changes,
			...resolution.applied,
			...resolution.cancelled,
		);
		resolved.applied.push(...resolution.applied);
		resolved.cancelled.push(...resolution.cancelled);
		resolved.breaks = resolved.breaks || resolution.breaks || result.breaks;

		if (resolved.breaks) {
			break;
		}
	}

	return resolved;
}

export function baseOperationContext(
	combat: CombatState,
	caster: CombatEntity,
	move: CombatMove | null,
	targets = emptyTargets(),
): OperationContext {
	return {
		combat,
		caster,
		move,
		targets,
	};
}
