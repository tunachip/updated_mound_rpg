// src/combat/ai/turnChoice.ts

import { CombatEntity, CombatState, TurnChoice } from "..";
import { CombatTeam } from "../../shared";
import { GoalType } from "./types";


export function makeTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): TurnChoice {
	for (const goal of entity.goals) {
		const current = resolveFieldValue(entity, goal.field);
		const desired = goal.value;

		if (goalSatisfied(current, desired, goal.goalType)) {
			continue;
		}

	}
}


