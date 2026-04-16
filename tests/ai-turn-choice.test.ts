import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeTurnChoices } from '../src/combat/ai/index.ts';
import { buildCombatState } from '../src/combat/constructor.ts';
import type { TurnChoice } from '../src/combat/models/index.ts';
import { executeTurnChoice, turnChoiceDisqualified } from '../src/combat/turn/index.ts';
import {
	ApplyAnger,
	ApplyDecay,
	ApplyFocus,
	ApplyRegen,
	ApplySlippery,
	ApplyStrong,
	ApplyTough,
	BankMove,
	BasicAttackMoves,
	BindMove,
	IgnoreSleep,
	NegateAnger,
	NegateExtraIterations,
	NegateRegen,
	NegateThunderAttunement,
} from '../src/data/templates/move/index.ts';
import { entityTargets, moveTargets } from '../src/combat/operations/index.ts';

function entityTemplate(
	id: string,
	name: string,
	moveTemplates: Array<{ id: string }>,
	aiTuning: Record<string, unknown> = {},
) {
	return {
		id,
		name,
		level: 3,
		xp: 0,
		entityType: 'forecasted' as const,
		hp: 10,
		maxHp: 10,
		energy: 3,
		maxEnergy: 3,
		shields: 0,
		aiTuning,
		moves: moveTemplates.map((move) => [move, []] as const),
		blessings: [],
		inventory: [],
	};
}

function revealAllMoves(
	combat: ReturnType<typeof buildCombatState>,
): void {
	for (const entity of [
		...combat.entities.party,
		...combat.entities.encounters,
	]) {
		for (const move of entity.moves) {
			move.isHidden = false;
		}
	}
}

function firstChoiceForMove(
	combat: ReturnType<typeof buildCombatState>,
	moveId: string,
) {
	return analyzeTurnChoices(combat, combat.entities.party[0]).find(
		(entry) => entry.choice.move.id === moveId,
	);
}

test('placeholder move templates apply their primary effects', () => {
	const cases = [
		{
			move: ApplySlippery,
			target: 'enemy' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const enemy = combat.entities.encounters[0];
				assert.equal(enemy.hasStatus.slick, true);
				assert.equal(enemy.statusTurns.slick, 1);
			},
		},
		{
			move: ApplyTough,
			target: 'ally' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const ally = combat.entities.party[1];
				assert.equal(ally.hasStatus.tough, true);
				assert.equal(ally.statusTurns.tough, 1);
			},
		},
		{
			move: ApplyAnger,
			target: 'enemy' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const enemy = combat.entities.encounters[0];
				assert.equal(enemy.hasStatus.anger, true);
				assert.equal(enemy.statusTurns.anger, 1);
			},
		},
		{
			move: ApplyRegen,
			target: 'ally' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const ally = combat.entities.party[1];
				assert.equal(ally.hasStatus.regen, true);
				assert.equal(ally.statusTurns.regen, 1);
			},
		},
		{
			move: ApplyStrong,
			target: 'ally' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const ally = combat.entities.party[1];
				assert.equal(ally.hasStatus.strong, true);
				assert.equal(ally.statusTurns.strong, 1);
			},
		},
		{
			move: ApplyDecay,
			target: 'enemy' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const enemy = combat.entities.encounters[0];
				assert.equal(enemy.hasStatus.decay, true);
				assert.equal(enemy.statusTurns.decay, 1);
			},
		},
		{
			move: ApplyFocus,
			target: 'ally' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const ally = combat.entities.party[1];
				assert.equal(ally.hasStatus.focus, true);
				assert.equal(ally.statusTurns.focus, 1);
			},
		},
		{
			move: NegateAnger,
			target: 'ally' as const,
			prepare: (combat: ReturnType<typeof buildCombatState>) => {
				const ally = combat.entities.party[1];
				ally.hasStatus.anger = true;
				ally.statusTurns.anger = 2;
			},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const ally = combat.entities.party[1];
				assert.equal(ally.hasStatus.anger, false);
				assert.equal(ally.statusTurns.anger, 0);
			},
		},
		{
			move: BankMove,
			target: 'move' as const,
			prepare: (combat: ReturnType<typeof buildCombatState>) => {
				combat.entities.party[0].moves[0].cooldownTurns = 2;
			},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				assert.equal(combat.entities.party[0].moves[0].cooldownTurns, 0);
			},
		},
		{
			move: NegateThunderAttunement,
			target: 'enemy' as const,
			prepare: (combat: ReturnType<typeof buildCombatState>) => {
				combat.entities.encounters[0].attunedTo.thunder = true;
			},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				assert.equal(combat.entities.encounters[0].attunedTo.thunder, false);
			},
		},
		{
			move: BindMove,
			target: 'enemyMove' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const move = combat.entities.encounters[0].moves[0];
				assert.equal(move.isBound, true);
				assert.equal(
					turnChoiceDisqualified(
						combat.entities.encounters[0],
						{ move, targets: entityTargets(combat.entities.party[0]) },
					),
					true,
				);
			},
		},
		{
			move: IgnoreSleep,
			target: 'ally' as const,
			prepare: (_combat: ReturnType<typeof buildCombatState>) => {},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				assert.equal(combat.entities.party[1].ignoresStatusTurns.sleep, 1);
			},
		},
		{
			move: NegateRegen,
			target: 'enemy' as const,
			prepare: (combat: ReturnType<typeof buildCombatState>) => {
				const enemy = combat.entities.encounters[0];
				enemy.hasStatus.regen = true;
				enemy.statusTurns.regen = 2;
			},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				const enemy = combat.entities.encounters[0];
				assert.equal(enemy.hasStatus.regen, false);
				assert.equal(enemy.statusTurns.regen, 0);
			},
		},
		{
			move: NegateExtraIterations,
			target: 'enemy' as const,
			prepare: (combat: ReturnType<typeof buildCombatState>) => {
				combat.entities.encounters[0].extraIterations = 2;
			},
			assertion: (combat: ReturnType<typeof buildCombatState>) => {
				assert.equal(combat.entities.encounters[0].extraIterations, 0);
			},
		},
	];

	for (const entry of cases) {
		const combat = buildCombatState(
			[
				entityTemplate('party_1', 'Planner', [BasicAttackMoves[0], entry.move]),
				entityTemplate('party_2', 'Ally', [BasicAttackMoves[1]]),
			],
			[
				entityTemplate('enemy_1', 'Enemy', [BasicAttackMoves[6]]),
			],
		);
		revealAllMoves(combat);
		entry.prepare(combat);

		const actor = combat.entities.party[0];
		const ally = combat.entities.party[1];
		const enemy = combat.entities.encounters[0];
		const move = actor.moves.find((candidate) => candidate.id === entry.move.id);
		assert.ok(move, `Missing move '${entry.move.id}'.`);

		let turnChoice: TurnChoice;
		switch (entry.target) {
			case 'ally':
				turnChoice = { move, targets: entityTargets(ally) };
				break;
			case 'enemy':
				turnChoice = { move, targets: entityTargets(enemy) };
				break;
			case 'move':
				turnChoice = { move, targets: moveTargets(actor.moves[0]) };
				break;
			case 'enemyMove':
				turnChoice = { move, targets: moveTargets(enemy.moves[0]) };
				break;
		}

		executeTurnChoice(combat, actor, turnChoice);
		entry.assertion(combat);
	}
});

test('move-targeted utility templates generate legal AI choices', () => {
	const combat = buildCombatState(
		[
			entityTemplate('party_1', 'Planner', [BasicAttackMoves[0], BankMove, BindMove]),
			entityTemplate('party_2', 'Ally', [BasicAttackMoves[1]]),
		],
		[
			entityTemplate('enemy_1', 'Enemy', [BasicAttackMoves[6]]),
		],
	);
	revealAllMoves(combat);
	combat.entities.party[0].moves[0].cooldownTurns = 2;

	const analyses = analyzeTurnChoices(combat, combat.entities.party[0]);
	assert.ok(
		analyses.some((entry) =>
			entry.choice.move.id === BankMove.id &&
			entry.choice.targets.moves.some((move) => move.id === combat.entities.party[0].moves[0].id),
		),
		'Expected a bank-move choice targeting a known move.',
	);
	assert.ok(
		analyses.some((entry) =>
			entry.choice.move.id === BindMove.id &&
			entry.choice.targets.moves.some((move) => move.id === combat.entities.encounters[0].moves[0].id),
		),
		'Expected a bind-move choice targeting a known enemy move.',
	);
});

test('planner values attunement negation only when the payoff survives', () => {
	const makeScenario = (enemyMoves: Array<{ id: string }>) => {
		const combat = buildCombatState(
			[
				entityTemplate(
					'party_1',
					'Planner',
					[BasicAttackMoves[5], NegateThunderAttunement],
					{ foresight: 2 },
				),
			],
			[
				entityTemplate(
					'enemy_1',
					'Enemy',
					enemyMoves,
					{ foresight: 2 },
				),
			],
		);
		combat.hasPriority = 'party';
		revealAllMoves(combat);
		combat.entities.encounters[0].attunedTo.thunder = true;
		return analyzeTurnChoices(combat, combat.entities.party[0]);
	};

	const withoutReapply = makeScenario([]);
	assert.equal(withoutReapply[0]?.choice.move.id, NegateThunderAttunement.id);

	const withReapply = makeScenario([BasicAttackMoves[6]]);
	assert.equal(withReapply[0]?.choice.move.id, 'focus:party_1');

	const negateWithoutReapply = withoutReapply.find(
		(entry) => entry.choice.move.id === NegateThunderAttunement.id,
	);
	const negateWithReapply = withReapply.find(
		(entry) => entry.choice.move.id === NegateThunderAttunement.id,
	);
	assert.ok(negateWithoutReapply && negateWithReapply);
	assert.ok(
		negateWithoutReapply.score > negateWithReapply.score,
		'Negating attunement should become materially worse when the enemy can reapply it before payoff.',
	);
});
