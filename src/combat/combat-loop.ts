// src/combat/combat-loop.ts

import type { CombatEntity, CombatState, TurnChoice } from '.';
import {
	makeTurnChoices,
	audit,
	turnChoiceDisqualified,
	executeTurnChoice,
	tickStatuses,
	tickCooldowns,
	tickAttunements,
	tickIgnoresStatuses,
	cleanupEntity,
} from './turn';

type EntityGroup = "party" | "encounters";

function setTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
	turnChoices: Array<TurnChoice>,
) {
	for (const [turnChoice, isPlayerKnown] of turnChoices) {
		entity.turnChoices.push(turnChoice);
		// TODO: This Represents a temporary means of knowing what the player knows
		// and thus what is made visible in the UI
		if (isPlayerKnown === true) {
			const player = combat.entities.party[0];
			player.knowledge.push(turnChoice);
		}
	}
}



export function combatLoop(
	combat: CombatState,
): void {
	while (true) {
		// turn choices
		const entities = [...combat.entities.encounters, ...combat.entities.party];
		const premoved = entities.filter(entity => entity.entityType !== 'controlled');
		const controlled = entities.filter(entity => entity.entityType === 'controlled');
		for (const group of [premoved, controlled] as const) {
			for (const entity of group) {
				setTurnChoices(combat, entity, entity.turnChoices);
			}
		}

		// for team of combat.entities
		let turnOrder = [combat.entities.encounters];
		let gainsPriority: EntityGroup = 'encounters';
		if (combat.hasPriority === 'party') {
			turnOrder = [combat.entities.party, ...turnOrder];
			gainsPriority = 'party';
		} else {
			turnOrder = [...turnOrder, combat.entities.party];
		}
		for (const team of turnOrder) {
			for (const entity of team) {
				const audits = audit(entity);

				// tick sick
				const sick = audits.statuses.filter(
					status => status === 'sick');
				if (sick.length > 0) {
					if (tickStatuses(combat, entity, ['sick'], 'up')) {
						break;
					}
				}

				// tick damage statuses
				const damageStatuses = audits.statuses.filter(
					status => status === 'burn' || 'decay');
				if (damageStatuses.length > 0) {
					if (tickStatuses(combat, entity, damageStatuses)) {
						break;
					}
				}

				// execute turn choices
				for (const turnChoice of entity.turnChoices) {
					if (turnChoiceDisqualified(entity, turnChoice) ||
						executeTurnChoice(combat, entity, turnChoice)
					) {
						break;
					}
				}

				// tick remaining statuses
				const remainingStatuses = audits.statuses.filter(
					status => status !== 'sick' || 'burn' || 'decay'
				);
				if (remainingStatuses.length > 0) {
					if (tickStatuses(combat, entity, remainingStatuses)) {
						break;
					}
				}

				// tick attunements
				if (audits.attunements.length > 0) {
					tickAttunements(entity, audits.attunements);
				}
				// tick ignoresStatuses
				if (audits.ignoresStatuses.length > 0) {
					tickIgnoresStatuses(entity, audits.ignoresStatuses);
				}
				// tick cooldowns
				if (audits.cooldowns.length > 0) {
					tickCooldowns(combat, entity, audits.cooldowns);
				}

				// cleanup temp vars on entity
				cleanupEntity(entity);

				//end entity turn
			}
			// end team turns
		}
		// turn-update-combatState
		combat.hasPriority = gainsPriority;
		combat.turn += 1;
	} 
}
