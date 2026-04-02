// src/combat/turn/turn-execute-choices.ts

import type { CombatEntity, TurnChoice } from '../models';
import type { CombatState } from '..';
import type { Operation, OperationContext } from '../operations';
import { turnChoiceDisqualified } from './turn-disqualifiers.ts';

function executeOperation(
	operation: Operation,
	ctx: OperationContext,
) {
	return operation.function(ctx);
}

function emitIntent (
	combat: CombatState,
	intents: Array<any>
): void {
	for (const listener of combat.listeners) {
		for (const intent of intents) {
			if (listener.trigger === intent.signal) {
			}
		}
	}
}

function executeTurnChoice (
	combat: CombatState,
	caster: CombatEntity,
	turnChoice: TurnChoice,
): boolean {
	const move = turnChoice[0];

	for (const operation of move.operations) {
		if (turnChoiceDisqualified(caster, turnChoice)) {
			return true;
		};

		const intents = executeOperation(
			operation,
			{
				caster: caster,
				move: move,
				targets: turnChoice[1],
			}
		);
	}

	return false;
}

export function executeTurnChoices (
	combat: CombatState,
	entity: CombatEntity,
): void {
	for (const turnChoice of entity.turnChoices) {
		if (executeTurnChoice(combat, entity, turnChoice)) {
			return;
		}
	}
	return;
}
