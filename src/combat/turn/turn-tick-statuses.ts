// src/combat/turn/turn-tick-statuses.ts

import type { StateChange } from '../operations';
import { DamageElement, Status } from '../../shared';
import { CombatState } from "..";
import { CombatBlessing, CombatEntity, CombatMove } from "../models";
import { applyCurseChance, applyDamageFromStatus, applyStatusTurns, reduceCooldownTurns, reduceStatusTurns } from "../operations";

export function tickStatuses(
	combat: CombatState,
	entity: CombatEntity,
	statuses: Array<Status>,
	direction: 'up' | 'down' = 'down',
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	for (const status of statuses) {
		if (entity.hasStatus[status]) {
			const ctx = {
				combat: combat,
				caster: entity,
				move: null,
				targets: { entities: [entity], moves: [], blessings: [] },
				status: status,
				amount: 1,
			};
			switch (status) {
				case 'decay':
					intents.push(...applyCurseChance(ctx));
				case 'burn':
					intents.push(...applyDamageFromStatus(ctx));
					continue;
				case 'sick':
					const sicknesses: Array<Status> = ['burn', 'decay', 'wound', 'curse'];
					intents.push(...tickStatuses(combat, entity, sicknesses, 'up'));
					continue;
			}
			if (direction === 'up') {
				intents.push(...applyStatusTurns(ctx));
			} else {
				intents.push(...reduceStatusTurns(ctx));
			}
		}
	}
	return intents;
}

export function tickAttunements(
	entity: CombatEntity,
	attunements: Array<DamageElement>,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const element of attunements) {
		if (entity.attunedTo[element]) {
			const before = entity.turnsAttuned[element];
			intents.push({
				host: entity,
				field: ['attunedTo', element],
				before: before,
				after: before + 1,
			});
		}
	}
	return intents;
}

export function tickIgnoresStatuses(
	entity: CombatEntity,
	statuses: Array<Status>,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	for (const status of statuses) {
		const before = entity.ignoresStatusTurns[status];
		const after = before - 1;
		intents.push({
			host: entity,
			field: ['ignoresStatusTurns', status],
			before: before,
			after: after,
		});
	}
	return intents;
}

export function tickCooldowns(
	combat: CombatState,
	entity: CombatEntity,
	hosts: Array<CombatMove | CombatBlessing>,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	for (const host of hosts) {
		const targets = {
				entities: [],
				moves: [],
				blessings: [],
		};
		// if host is blessing, goes in blessings, else in moves

		reduceCooldownTurns({
			combat: combat,
			caster: entity,
			targets: targets,
			amount: 1
		})
	}
	return intents;
}
