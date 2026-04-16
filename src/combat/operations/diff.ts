// src/combat/operations/diff.ts

import type { RegisteredRuntimeListener } from './types.ts';
import type { CombatState } from '..';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';

export type StateChangeHost = CombatEntity | CombatMove | CombatBlessing | CombatState;
export type StateChangeSignal = string;

export interface StateChange {
	host: StateChangeHost;
	field: Array<string>;
	before: unknown;
	after: unknown;
	signal?: StateChangeSignal;
	apply?: boolean;
	registeredListener?: RegisteredRuntimeListener;
}

function isCombatEntity(
	host: StateChangeHost
): host is CombatEntity {
	return 'entityType' in host;
}

function isCombatMove(
	host: StateChangeHost
): host is CombatMove {
	return 'moveType' in host;
}

function isCombatState(
	host: StateChangeHost
): host is CombatState {
	return (
		'turn' in host &&
		'entities' in host &&
		'listeners' in host &&
		'eventLog' in host
	);
}

function hostPrefix(
	host: StateChangeHost
): 'combat' | 'entity' | 'move' | 'blessing' {
	switch (true) {
		case isCombatState(host):
			return 'combat';
		case isCombatEntity(host):
			return 'entity';
		case isCombatMove(host):
			return 'move';
		default:
			return 'blessing';
	}
}

export function getStateChangeSignal(
	change: StateChange
): StateChangeSignal {
	if (change.signal) {
		return change.signal;
	}
	return `${hostPrefix(change.host)}.${change.field.join('.')}`;
}

export function getStateChangeKey(
	change: StateChange
): string {
	const hostId = isCombatState(change.host) ? 'state' : change.host.id;
	if (change.signal) {
		return `${hostPrefix(change.host)}:${hostId}:signal:${change.signal}`;
	}
	return `${hostPrefix(change.host)}:${hostId}:${change.field.join('.')}`;
}

export function isNoopStateChange(
	change: StateChange
): boolean {
	return Object.is(change.before, change.after);
}

export function mergeStateChanges(
	changes: Array<StateChange>
): Array<StateChange> {
	const merged = new Map<string, StateChange>();

	for (const change of changes) {
		const key = getStateChangeKey(change);
		const existing = merged.get(key);
		if (!existing) {
			merged.set(key, {
				host: change.host,
				field: [...change.field],
				before: change.before,
				after: change.after,
				signal: change.signal,
				apply: change.apply,
				registeredListener: change.registeredListener,
			});
			continue;
		}
		existing.after = change.after;
		existing.signal = change.signal ?? existing.signal;
		existing.apply = change.apply ?? existing.apply;
		existing.registeredListener = change.registeredListener ?? existing.registeredListener;
	}

	return [...merged.values()].filter(
		(change) => !isNoopStateChange(change)
	);
}

function getParentValue(
	change: StateChange
): Record<string, unknown> {
	let current: unknown = change.host;
	for (const key of change.field.slice(0, -1)) {
		current = (current as Record<string, unknown>)[key];
	}
	return current as Record<string, unknown>;
}

export function applyStateChange(
	change: StateChange
): void {
	if (change.apply === false) {
		return;
	}
	if (change.field.length === 0) {
		throw new Error('StateChange field path must contain at least one segment.');
	}

	const parent = getParentValue(change);
	const field = change.field[change.field.length - 1];
	parent[field] = change.after;
}

export function applyStateChanges(
	changes: Array<StateChange>
): Array<StateChange> {
	const merged = mergeStateChanges(changes);
	const applied: Array<StateChange> = [];
	for (const change of merged) {
		if (change.apply === false) {
			continue;
		}
		applyStateChange(change);
		applied.push(change);
	}
	return applied;
}
