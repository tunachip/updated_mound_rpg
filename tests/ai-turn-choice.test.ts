import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeTurnChoices } from '../src/combat/ai/index.ts';
import { buildCombatState } from '../src/combat/constructor.ts';
import type { TurnChoice } from '../src/combat/models/index.ts';
import {
	audit,
	executeTurnChoice,
	tickListenerCharges,
	turnChoiceDisqualified,
} from '../src/combat/turn/index.ts';
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

test('updated utility move templates apply their primary effects', () => {
	const combat = buildCombatState(
		[
			entityTemplate(
				'party_1',
				'Planner',
				[
					ApplySlippery,
					ApplyTough,
					ApplyAnger,
					ApplyRegen,
					ApplyStrong,
					ApplyDecay,
					ApplyFocus,
					NegateAnger,
					BankMove,
					NegateThunderAttunement,
					BindMove,
					IgnoreSleep,
					NegateRegen,
					NegateExtraIterations,
					BasicAttackMoves[2],
				],
			),
			entityTemplate('party_2', 'Ally', [BasicAttackMoves[1]]),
		],
		[
			entityTemplate('enemy_1', 'Enemy', [BasicAttackMoves[6]]),
		],
	);
	revealAllMoves(combat);

	const actor = combat.entities.party[0];
	const ally = combat.entities.party[1];
	const enemy = combat.entities.encounters[0];
	const moveById = new Map(actor.moves.map((move) => [move.id, move]));

	executeTurnChoice(combat, actor, {
		move: moveById.get(ApplySlippery.id)!,
		targets: entityTargets(actor),
	});
	assert.equal(actor.hasStatus.slick, true);
	assert.equal(actor.statusTurns.slick, 2);
	assert.equal(moveById.get(ApplySlippery.id)!.cooldownTurns, 2);

	executeTurnChoice(combat, actor, {
		move: moveById.get(ApplyTough.id)!,
		targets: entityTargets(ally),
	});
	assert.equal(ally.hasStatus.tough, true);
	assert.equal(ally.statusTurns.tough, 2);
	assert.equal(moveById.get(ApplyTough.id)!.cooldownTurns, 2);

	executeTurnChoice(combat, actor, {
		move: moveById.get(ApplyAnger.id)!,
		targets: entityTargets(enemy),
	});
	const angerListeners = combat.listeners.filter(
		(listener) => listener.listener.id === 'move_apply_anger:on_fire_damage',
	);
	assert.equal(angerListeners.length, 2);
	assert.deepEqual(
		angerListeners.map((listener) => listener.owner.id).sort(),
		[actor.id, enemy.id].sort(),
	);
	assert.ok(angerListeners.every((listener) => listener.chargeTurns === 3));

	executeTurnChoice(combat, actor, {
		move: moveById.get(ApplyRegen.id)!,
		targets: entityTargets(ally),
	});
	assert.equal(ally.hasStatus.regen, true);
	assert.equal(ally.statusTurns.regen, 3);
	assert.equal(moveById.get(ApplyRegen.id)!.isBanked, true);

	executeTurnChoice(combat, actor, {
		move: moveById.get(ApplyStrong.id)!,
		targets: entityTargets(enemy),
	});
	assert.equal(enemy.hasStatus.strong, true);
	assert.equal(enemy.statusTurns.strong, 2);
	assert.equal(
		combat.listeners.filter(
			(listener) => listener.listener.id === 'move_apply_strong:on_damage',
		).length,
		1,
	);

	const energyBeforeDecay = actor.energy;
	executeTurnChoice(combat, actor, {
		move: moveById.get(ApplyDecay.id)!,
		targets: entityTargets(enemy),
	});
	assert.equal(enemy.hasStatus.decay, true);
	assert.equal(enemy.statusTurns.decay, 2);
	assert.equal(actor.energy, energyBeforeDecay - 2);

	executeTurnChoice(combat, actor, {
		move: moveById.get(ApplyFocus.id)!,
		targets: entityTargets(actor),
	});
	assert.equal(actor.hasStatus.focus, true);
	assert.equal(actor.statusTurns.focus, 1);
	assert.equal(ally.hasStatus.focus, true);
	assert.equal(ally.statusTurns.focus, 1);

	ally.hasStatus.anger = true;
	ally.statusTurns.anger = 2;
	executeTurnChoice(combat, actor, {
		move: moveById.get(NegateAnger.id)!,
		targets: entityTargets(ally),
	});
	assert.equal(ally.hasStatus.anger, false);
	assert.equal(ally.statusTurns.anger, 0);
	assert.equal(moveById.get(NegateAnger.id)!.cooldownTurns, 2);

	executeTurnChoice(combat, actor, {
		move: moveById.get(BankMove.id)!,
		targets: moveTargets(enemy.moves[0]),
	});
	assert.equal(enemy.moves[0].isBanked, true);
	assert.equal(moveById.get(BankMove.id)!.isBanked, true);

	enemy.attunedTo.thunder = true;
	enemy.energy = 1;
	const enemyEnergyBeforeNegate = enemy.energy;
	executeTurnChoice(combat, actor, {
		move: moveById.get(NegateThunderAttunement.id)!,
		targets: entityTargets(enemy),
	});
	assert.equal(enemy.attunedTo.thunder, false);
	assert.equal(enemy.energy, enemyEnergyBeforeNegate + 1);

	executeTurnChoice(combat, actor, {
		move: moveById.get(BindMove.id)!,
		targets: moveTargets(enemy.moves[0]),
	});
	assert.equal(enemy.moves[0].isBound, true);
	assert.equal(moveById.get(BindMove.id)!.isBound, true);

	executeTurnChoice(combat, actor, {
		move: moveById.get(IgnoreSleep.id)!,
		targets: entityTargets(actor),
	});
	assert.equal(actor.ignoresStatusTurns.sleep, 2);
	assert.ok(moveById.get(IgnoreSleep.id)!.ignoresStatuses.includes('sleep'));
	actor.hasStatus.sleep = true;
	actor.statusTurns.sleep = 1;
	assert.equal(
		turnChoiceDisqualified(actor, {
			move: moveById.get(IgnoreSleep.id)!,
			targets: entityTargets(actor),
		}),
		false,
	);
	actor.hasStatus.sleep = false;
	actor.statusTurns.sleep = 0;

	enemy.hasStatus.regen = true;
	enemy.statusTurns.regen = 2;
	executeTurnChoice(combat, actor, {
		move: moveById.get(NegateRegen.id)!,
		targets: entityTargets(enemy),
	});
	assert.equal(enemy.hasStatus.regen, false);
	assert.equal(enemy.statusTurns.regen, 0);

	enemy.extraIterations = 2;
	executeTurnChoice(combat, actor, {
		move: moveById.get(NegateExtraIterations.id)!,
		targets: entityTargets(enemy),
	});
	assert.equal(enemy.extraIterations, 0);
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
	combat.entities.party[0].moves[0].isHidden = true;

	const analyses = analyzeTurnChoices(combat, combat.entities.party[0]);
	assert.ok(
		analyses.every((entry) =>
			entry.choice.move.id !== BankMove.id ||
			entry.choice.targets.moves.every((move) => move.isHidden === false),
		),
		'Expected bank-move choices to target only revealed moves.',
	);
	assert.ok(
		analyses.some((entry) =>
			entry.choice.move.id === BindMove.id &&
			entry.choice.targets.moves.some((move) => move.id === combat.entities.encounters[0].moves[0].id),
		),
		'Expected a bind-move choice targeting a known enemy move.',
	);
});

test('slick causes misses in combat execution and reduces AI attack valuation', () => {
	const originalRandom = Math.random;
	try {
		const combat = buildCombatState(
			[
				entityTemplate('party_1', 'Planner', [BasicAttackMoves[0]]),
			],
			[
				entityTemplate('enemy_1', 'Slippery Target', [BasicAttackMoves[6]]),
				entityTemplate('enemy_2', 'Stable Target', [BasicAttackMoves[5]]),
			],
		);
		revealAllMoves(combat);
		combat.entities.encounters[0].hasStatus.slick = true;
		combat.entities.encounters[0].statusTurns.slick = 5;

		const analyses = analyzeTurnChoices(combat, combat.entities.party[0]);
		assert.equal(
			analyses[0]?.choice.targets.entities[0]?.id,
			'enemy_2',
			'Expected AI to prefer the non-slick target when damage is otherwise equal.',
		);

		Math.random = () => 0.99;
		executeTurnChoice(combat, combat.entities.party[0], {
			move: combat.entities.party[0].moves[0],
			targets: entityTargets(combat.entities.encounters[0]),
		});
		assert.equal(combat.entities.encounters[0].hp, 10);
		assert.equal(combat.entities.encounters[0].dodges, 1);
	} finally {
		Math.random = originalRandom;
	}
});

test('listener charges tick down and expire', () => {
	const combat = buildCombatState(
		[
			entityTemplate('party_1', 'Planner', [ApplyAnger]),
		],
		[
			entityTemplate('enemy_1', 'Enemy', [BasicAttackMoves[6]]),
		],
	);
	revealAllMoves(combat);

	executeTurnChoice(combat, combat.entities.party[0], {
		move: combat.entities.party[0].moves[0],
		targets: entityTargets(combat.entities.encounters[0]),
	});

	for (let index = 0; index < 3; index += 1) {
		const audits = audit(combat.entities.party[0], combat);
		tickListenerCharges(combat, combat.entities.party[0], audits.listeners);
	}

	assert.equal(
		combat.listeners.some((listener) => listener.owner.id === combat.entities.party[0].id),
		false,
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
