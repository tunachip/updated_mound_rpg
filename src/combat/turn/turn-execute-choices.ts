// src/combat/turn/turn-execute-choices.ts

import type { CombatEntity, TurnChoice } from '../models';
import type { CombatState } from '..';
import type { StateChange } from '../operations';
import {
	baseOperationContext,
	executeOperation,
	hydrateRuntimeListeners,
	mergeStateChanges,
	resolveStateChanges,
} from '../operations';
import { turnChoiceDisqualified } from './turn-disqualifiers.ts';

function executeTurnChoice(
	combat: CombatState,
	caster: CombatEntity,
	turnChoice: TurnChoice,
): boolean {
	const move = turnChoice.move;
	const baseCtx = baseOperationContext(combat, caster, move, turnChoice.targets);
	const emittedChanges: Array<StateChange> = [];

	for (const operation of move.operations) {
		if (turnChoiceDisqualified(caster, turnChoice)) {
			return true;
		}

		const result = executeOperation(operation, {
			...baseCtx,
			changes: mergeStateChanges(emittedChanges),
		});
		const resolution = resolveStateChanges(combat, result.changes, move);
		emittedChanges.push(
			...result.changes,
			...resolution.applied,
			...resolution.cancelled,
		);
		if (resolution.breaks || result.breaks) {
			return false;
		}
	}

	return false;
}

export function executeTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): void {
	hydrateRuntimeListeners(combat);
	for (const turnChoice of entity.turnChoices) {
		if (executeTurnChoice(combat, entity, turnChoice)) {
			return;
		}
	}
}
