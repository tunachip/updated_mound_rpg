// src/combat/combat-loop.ts

import type { CombatEntity, CombatState, TurnChoice } from '.';
import {
	hydrateAiGoalListeners,
	hydrateCombatGoals,
	primeAiPredictionCache,
} from './ai/index.ts';
import {
	audit,
	cleanupEntity,
	executeTurnChoice,
	makeTurnChoices,
	tickAttunements,
	tickCooldowns,
	tickIgnoresStatuses,
	tickStatuses,
} from './turn/index.ts';

type EntityGroup = 'party' | 'encounters';
type KnownTurnChoice = [TurnChoice, boolean];

function setTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
	turnChoices: Array<KnownTurnChoice>,
): void {
	for (const [turnChoice, isPlayerKnown] of turnChoices) {
		entity.turnChoices.push(turnChoice);
		if (isPlayerKnown) {
			const player = combat.entities.party[0];
			player.knowledge.push(turnChoice);
		}
	}
}

function refreshTurnChoices(
	combat: CombatState,
): void {
	hydrateCombatGoals(combat);
	hydrateAiGoalListeners(combat);
	primeAiPredictionCache(combat);

	const entities = [...combat.entities.encounters, ...combat.entities.party];
	const premoved = entities.filter((entity) => entity.entityType !== 'controlled');
	const controlled = entities.filter((entity) => entity.entityType === 'controlled');

	for (const group of [premoved, controlled] as const) {
		for (const entity of group) {
			setTurnChoices(combat, entity, makeTurnChoices(combat, entity));
		}
	}
}

function teamTurnOrder(
	combat: CombatState,
): Array<Array<CombatEntity>> {
	if (combat.hasPriority === 'party') {
		return [combat.entities.party, combat.entities.encounters];
	}
	return [combat.entities.encounters, combat.entities.party];
}

function splitTickStatuses(
	statuses: ReturnType<typeof audit>['statuses'],
): {
	damage: Array<'burn' | 'decay'>;
	remaining: Array<Exclude<keyof CombatEntity['hasStatus'], 'burn' | 'decay' | 'wound'>>;
} {
	return {
		damage: statuses.filter((status): status is 'burn' | 'decay' =>
			status === 'burn' || status === 'decay',
		),
		remaining: statuses.filter(
			(status): status is Exclude<typeof status, 'burn' | 'decay' | 'wound'> =>
				status !== 'burn' &&
				status !== 'decay' &&
				status !== 'wound',
		),
	};
}

function runEntityTurn(
	combat: CombatState,
	entity: CombatEntity,
): void {
	if (entity.isDead) {
		cleanupEntity(entity);
		return;
	}

	const audits = audit(entity);
	const statuses = splitTickStatuses(audits.statuses);

	if (statuses.damage.length > 0) {
		tickStatuses(combat, entity, statuses.damage);
	}

	if (!entity.isDead) {
		for (const turnChoice of entity.turnChoices) {
			if (executeTurnChoice(combat, entity, turnChoice)) {
				break;
			}
		}
	}

	if (statuses.remaining.length > 0) {
		tickStatuses(combat, entity, statuses.remaining);
	}
	if (audits.attunements.length > 0) {
		tickAttunements(combat, entity, audits.attunements);
	}
	if (audits.ignoresStatuses.length > 0) {
		tickIgnoresStatuses(combat, entity, audits.ignoresStatuses);
	}
	if (audits.cooldowns.length > 0) {
		tickCooldowns(combat, entity, audits.cooldowns);
	}
	cleanupEntity(entity);
}

export function combatLoop(
	combat: CombatState,
): void {
	while (true) {
		refreshTurnChoices(combat);

		const gainsPriority: EntityGroup =
			combat.hasPriority === 'party'
				? 'encounters'
				: 'party';

		for (const team of teamTurnOrder(combat)) {
			for (const entity of team) {
				runEntityTurn(combat, entity);
			}
		}

		combat.hasPriority = gainsPriority;
		combat.turn += 1;
	}
}
