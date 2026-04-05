// src/combat/turn/turn-execute-choices.ts

import type { CombatEntity, TurnChoice } from '../models';
import type { CombatState } from '..';
import type { StateChange } from '../operations/index.ts';
import {
	baseOperationContext,
	executeOperation,
	hydrateRuntimeListeners,
	mergeStateChanges,
	resolveStateChanges,
} from '../operations/index.ts';
import { turnChoiceDisqualified } from './turn-disqualifiers.ts';

function revealMoveOnCast(
	combat: CombatState,
	move: TurnChoice['move'],
): void {
	if (move.isHidden === false) {
		return;
	}

	resolveStateChanges(
		combat,
		[{
			host: move,
			field: ['isHidden'],
			before: true,
			after: false,
			signal: `move.revealed.${move.id}`,
		}],
		move,
	);
}

export function executeTurnChoice(
	combat: CombatState,
	caster: CombatEntity,
	turnChoice: TurnChoice,
): boolean {
	if (turnChoiceDisqualified(caster, turnChoice)) {
		return true;
	}

	const move = turnChoice.move;
	const baseCtx = baseOperationContext(combat, caster, move, turnChoice.targets);
	const emittedChanges: Array<StateChange> = [];

	revealMoveOnCast(combat, move);

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
			return true;
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
