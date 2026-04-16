// src/combat/turn/turn-tick-statuses.ts

import type { DamageElement, Status } from '../../shared';
import type { CombatState } from '../types.ts';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { RegisteredRuntimeListener } from '../operations/index.ts';
import {
	blessingTargets,
	entityTargets,
	moveTargets,
	reduceCooldownTurns,
	resolveStateChanges,
	tickAllAttunementTurns,
	tickIgnoreStatusTurns,
	tickStatus,
} from '../operations/index.ts';

function resolveTickChanges(
	combat: CombatState,
	changes: ReturnType<typeof tickStatus>,
): void {
	if (changes.length === 0) {
		return;
	}

	resolveStateChanges(combat, changes, null);
}

export function tickStatuses(
	combat: CombatState,
	entity: CombatEntity,
	statuses: Array<Status>,
): void {
	for (const status of statuses) {
		if (!entity.hasStatus[status]) {
			continue;
		}
		resolveTickChanges(
			combat,
			tickStatus({
				combat,
				caster: entity,
				move: null,
				targets: entityTargets(entity),
				status,
				amount: 1,
			}),
		);
	}
}

export function tickAttunements(
	combat: CombatState,
	entity: CombatEntity,
	attunements: Array<DamageElement>,
): void {
	if (attunements.length === 0) {
		return;
	}

	resolveTickChanges(
		combat,
		tickAllAttunementTurns({
			combat,
			caster: entity,
			move: null,
			targets: entityTargets(entity),
			amount: 1,
		}),
	);
}

export function tickIgnoresStatuses(
	combat: CombatState,
	entity: CombatEntity,
	statuses: Array<Status>,
): void {
	for (const status of statuses) {
		resolveTickChanges(
			combat,
			tickIgnoreStatusTurns({
				combat,
				caster: entity,
				move: null,
				targets: entityTargets(entity),
				status,
				amount: 1,
			}),
		);
	}
}

function cooldownTargets(
	host: CombatMove | CombatBlessing,
) {
	return 'moveType' in host
		? moveTargets(host)
		: blessingTargets(host);
}

export function tickCooldowns(
	combat: CombatState,
	entity: CombatEntity,
	hosts: Array<CombatMove | CombatBlessing>,
): void {
	for (const host of hosts) {
		resolveTickChanges(
			combat,
			reduceCooldownTurns({
				combat,
				caster: entity,
				move: null,
				targets: cooldownTargets(host),
				amount: 1,
			}),
		);
	}
}

export function tickListenerCharges(
	combat: CombatState,
	entity: CombatEntity,
	listeners: Array<RegisteredRuntimeListener>,
): void {
	if (listeners.length === 0) {
		return;
	}

	for (const listener of listeners) {
		if (listener.owner.id !== entity.id || listener.chargeTurns <= 0) {
			continue;
		}
		listener.chargeTurns -= 1;
	}

	combat.listeners = combat.listeners.filter((listener) =>
		listener.chargeTurns !== 0,
	);
}
