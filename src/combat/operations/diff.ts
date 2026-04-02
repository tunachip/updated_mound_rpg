// src/combat/operations/diff.ts

import type { CombatBlessing, CombatEntity, CombatMove } from '../models';

export type StateChangeHost = CombatEntity | CombatMove | CombatBlessing;
export type StateChangeSignal = string;

export interface StateChange {
	host: StateChangeHost;
	field: Array<string>;
	before: unknown;
	after: unknown;
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

function hostPrefix(
	host: StateChangeHost
): 'entity' | 'move' | 'blessing' {
	switch (true) {
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
	return `${hostPrefix(change.host)}.${change.field.join('.')}`;
}

export function getStateChangeKey(
	change: StateChange
): string {
	return `${hostPrefix(change.host)}:${change.host.id}:${change.field.join('.')}`;
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
			});
			continue;
		}
		existing.after = change.after;
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
	for (const change of merged) {
		applyStateChange(change);
	}
	return merged;
}
