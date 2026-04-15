// src/combat/ai/turnChoice.ts

import { CombatEntity, CombatState, randomNumber, TurnChoice } from "..";
import { CombatTeam } from "../../shared";
import { Goal, TemperamentChoice } from "./types";


function filterGoalsByTemperament(
	entity: CombatEntity,
	goals: Array<Goal>
): [TemperamentChoice, Array<Goal>] {
	if (goals.length < 1) {
		return ['ambivalent', goals];
	}

	const progressive = entity.aiTuning.temperament.progressive;
	const conservative = entity.aiTuning.temperament.conservative;
	const total = progressive + conservative;
	const random = randomNumber(1, total);

	const isConservative = random > progressive;
	const filteredGoals = isConservative
		? goals.filter(goal =>
			goal.goalType === "maintain")
		: goals.filter(goal =>
			goal.goalType === "approach" ||
			goal.goalType === "prevent");

	return [
		isConservative ? 'conservative' : 'progressive',
		filteredGoals.length > 0 ? filteredGoals : goals
	];
}

export function makeTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): TurnChoice {
	const choices: Array<TurnChoice> = [];

	// Create a List of Goals filtered by Temperament
	const [goalScope, entityGoals] = filterGoalsByTemperament(entity, entity.goals);
	const filteredEntityGoals =
		goalScope === 'progressive' && entity.aiTuning.hasGrudges
			? entityGoals.filter(goal =>
				goal.id === "killEnemy" ||
				goal.id === "applyStatusToEnemy")
			: entityGoals;

	if (filteredEntityGoals.length > 0) {
		// Pick Goals from list of filtered goals
	}
	// Get turn Choice at random
	return choices[randomNumber(0, choices.length - 1)];
}
