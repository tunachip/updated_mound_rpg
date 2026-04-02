// src/combat/operations/resolver.ts

import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';
import {
	applyStateChange,
	applyStateChanges,
	getStateChangeSignal,
	isNoopStateChange,
	mergeStateChanges,
	type StateChange,
} from './diff.ts';
import { emptyTargets } from './helpers.ts';
import type {
	Listener,
	ListenerContext,
	Operation,
	OperationContext,
	OperationResult,
	PreviewSequence,
	RegisteredRuntimeListener,
	ResolutionResult,
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
	blessing: CombatBlessing,
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
): Array<RegisteredRuntimeListener> {
	const trigger = getStateChangeSignal(change);
	return combat.listeners.filter(
		(registered) =>
			registered.listener.phase === phase &&
			registered.listener.trigger === trigger &&
			registered.listener.conditions.every((condition) =>
				condition(
					createListenerContext(
						combat,
						registered.owner,
						registered.blessing,
						change,
						null,
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
	};

	const sideEffects: Array<StateChange> = [];
	let cancelled = false;
	let breaks = false;

	for (const registered of matchingListeners(combat, phase, pendingChange)) {
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
	const changes: Array<StateChange> = [];
	const sequence: PreviewSequence = [];
	const appliedForPreview: Array<StateChange> = [];

	try {
		for (const operation of operations) {
			const result = executeOperation(operation, baseCtx);
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
	const listeners: Array<RegisteredRuntimeListener> = [];

	for (const entity of [
		...combat.entities.party,
		...combat.entities.encounters
	]) {
		for (const blessing of entity.blessings) {
			if (blessing.isExhausted) {
				continue;
			}
			for (const listener of blessing.listeners) {
				listeners.push({
					owner: entity,
					blessing,
					listener,
				});
			}
		}
	}

	combat.listeners = listeners;
	return listeners;
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
	const previewSequence = previewOperations(operations, baseCtx);
	const finalChanges = previewSequence[previewSequence.length - 1] ?? [];
	return resolveStateChanges(combat, finalChanges, baseCtx.move);
}

export function baseOperationContext(
	caster: CombatEntity,
	move: CombatMove | null,
	targets = emptyTargets(),
): OperationContext {
	return {
		caster,
		move,
		targets,
	};
}
