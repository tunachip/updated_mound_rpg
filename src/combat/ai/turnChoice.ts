// src/combat/ai/turnChoice.ts

import { applyEnergy, entityTargets, operation, selfTargets, ifThenElse, } from '..';
import type { CombatEntity, CombatMove, CombatState, TurnChoice } from "..";
import { moveEntity } from '../operations/move-entity';
import { turnChoiceDisqualified } from '../turn/turn-disqualifiers';

function focus(
	entity: CombatEntity,
): TurnChoice {
	const ignoresStatuses = Object.assign([
		'sleep', 'anger', 'stun'
	] as CombatMove['ignoresStatuses'],
		{
			sleep: true,
			anger: true,
			stun: true,
		},
	);

	return {
		move: {
			id: 'focus',
			name: 'Focus',
			description: 'Skips Turn to Regain 1 Energy. Ignores Sleep, Stun, and Anger.',
			element: 'neutral',
			moveType: 'focus',
			owner: entity,
			targetType: {
				type: 'self',
				range: [0, 0],
			},
			baseDamage: 0,
			baseIterations: 1,
			cooldownTurns: 0,
			isBound: false,
			ignoresStatuses,
			operations: [
				operation(applyEnergy, {
					ctx: { amount: 1 },
					targets: selfTargets(),
				}),
			],
			loopOperations: [],
		},
		targets: entityTargets(entity),
		isFocus: true,
	};
}

function move(
	entity: CombatEntity
): TurnChoice {
	// TODO: Create Index Choice Logic
	const newEntityIndex = 0;

	return {
		move: {
			id: 'focus',
			name: 'Focus',
			description: 'Skips Turn to Change Entity Position. Fails on Stun.',
			element: 'neutral',
			moveType: 'focus',
			owner: entity,
			targetType: {
				type: 'self',
				range: [0, 0],
			},
			baseDamage: 0,
			baseIterations: 1,
			cooldownTurns: 0,
			isBound: false,
			ignoresStatuses: [],
			operations: [
				// fails on entity.hasStatus.stun === true
				operation(ifThenElse, {
					ctx: {}
				}),
				operation(moveEntity, {
					ctx: { entityIndex: newEntityIndex },
					targets: selfTargets(),
				}),
			],
			loopOperations: [],
		},
		targets: entityTargets(entity),
	}
}

export function calculateTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<Array<TurnChoice>> {
	if (entity.entityType === 'controlled') {
		throw new Error('Controlled Entities should have TurnChoices decided by the Player');
	}

	// Uses Diff, Level(AI IQ), & AI Goals Hierarchy
	// Composes an ordered list of turnChoices
	// From this, the first legal choice is taken

	// Always available:
	//	1. 'Cast':	choose active CombatMove to cast
	//	2. 'Chain': choose a chain of active CombatMoves to cast.
	//							chained moves require a chain tax
	//							chain tax is 1 more than the last paid (starting at 1)
	//							chain tax is checked before cast, but is paid at runtime
	//							accordingly, chains of costless moves will look like this:
	//								move_1 --(pay 1)-->
	//								move_2 --(pay 2)-->
	//								move_3 --(pay 3)-->
	//								move_4 --(pay 4)-->
	//								...
	//	3. 'Focus': skip turn, gain 1 energy
	//	4. 'Move':	move this entity to another spot in the team array
	const orderedTurnChoiceOptions: Array<Array<TurnChoice>> = [];

	// basic turn choice options
	const turnChoiceOptions: Array<Array<TurnChoice>> = [
		[focus(entity)],
		[move(entity)],
	];
	const targets = {
		entities: [
			...combat.entities.encounters,
			...combat.entities.party,
		],
		moves: [],
		blessings: [],
	};

	// move-based turn choice options
	while (true) {
		const moves = entity.moves;
		if (moves.length < 1) {
			return turnChoiceOptions;
		}

		// TODO: This is too limiting for late game
		// we should be doing this with a function that can handle
		// higher values than this 
		// as maxEnergy can increase / can happen with special ability
		let maxChainLength = 0
		switch (entity.energy) {
			case 0:
				break;
			case 1:
			case 2:
				maxChainLength += 1;
			case 3:
			case 4:
			case 5:
				maxChainLength += 1;
			case 6:
				maxChainLength += 1;
				break;
		}

		// chain segments
		//
		// I've not done a great job here, but basically
		// we are finding all legal chains of all legal lengths
		// and then evaluating if they are legal choices
		// and if so, we are putting them into the array
		for (let i = 0; i > maxChainLength; i += 1) {
			const moveChain: Array<TurnChoice> = [];
			for (const move of moves) {
				const moveChoices: Array<TurnChoice> = [];
				// TODO: Update this funciton in general to handle the targetType correctly
				// ideally this will be very efficient by not wasting time checking invalid typed options
				for (const entity of targets.entities) {
					const moveChoice = {
						move: move,
						targets: {
							entities: [entity],
							moves: [],
							blessings: []
						}
					};
					if (turnChoiceDisqualified(entity, moveChoice)) {
						continue;
					}
					moveChoices.push(moveChoice);
				}
			}
		}

		// after this, we then take what we know about other entity movepools via entity.knowledge
		// from this, we then do 'future turn calculation'
		// this is essentially chess ai -- we are thinking X turns ahead, checking all options
		// using the diff from each step to evaluate all the board states
		// we then compare that against our goal hierarchy and order the movechoices according to this
		// level is the number of turns we predict forward
		for (let i=0; i>entity.level; i+= 1) {

		}

		return orderedTurnChoiceOptions;
	}
}
