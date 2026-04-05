// src/combat/ai/turnChoice.ts

import { DamageElements, Statuses } from '../../shared/index.ts';

import type { Goal } from './types.ts';
import type {
	AiPredictionCache,
	AwarenessTeam,
	BranchPrediction,
	ProjectedChoice,
	StateChoiceCatalog,
} from './cache.ts';
import {
	createAiPredictionCache,
	markAiPredictionCacheDirty,
	pruneAiPredictionCache,
	recordAiPredictionChild,
	setAiPredictionCacheRoot,
} from './cache.ts';
import type { CombatEntity, CombatMove, TurnChoice } from '../models';
import type { CombatState } from '../types.ts';
import {
	applyEnergy,
	applyStateChange,
	applyStateChanges,
	baseOperationContext,
	entityTargets,
	emptyTargets,
	makeTargets,
	mergeStateChanges,
	operation,
	previewOperations,
	selfTargets,
	type StateChange,
	type TargetMatrix,
} from '../operations/index.ts';
import { moveEntity } from '../operations/move-entity.ts';
import { turnChoiceDisqualified } from '../turn/turn-disqualifiers.ts';

export interface GoalContribution {
	goal: Goal;
	score: number;
}

export interface ChoiceAnalysis {
	choice: TurnChoice;
	score: number;
	contributions: Array<GoalContribution>;
	predictedChanges: Array<StateChange>;
	futureActorIds: Array<string>;
}

function sameField(
	left: Array<string>,
	right: Array<string>,
): boolean {
	return left.length === right.length &&
		left.every((segment, index) => segment === right[index]);
}

function readPath(
	host: unknown,
	field: Array<string>,
): unknown {
	let current: unknown = host;
	for (const segment of field) {
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function projectedValue(
	goal: Goal,
	changes: Array<StateChange>,
): unknown {
	for (let i = changes.length - 1; i >= 0; i -= 1) {
		const change = changes[i];
		if (change.host !== goal.host) {
			continue;
		}
		if (sameField(change.field, goal.field)) {
			return change.after;
		}
	}
	return readPath(goal.host, goal.field);
}

function valueDistance(
	value: unknown,
	target: unknown,
): number {
	if (typeof value === 'number' && typeof target === 'number') {
		return Math.abs(value - target);
	}
	if (typeof value === 'boolean' && typeof target === 'boolean') {
		return value === target ? 0 : 1;
	}
	return Object.is(value, target) ? 0 : 1;
}

function scoreGoal(
	goal: Goal,
	changes: Array<StateChange>,
): number {
	const before = readPath(goal.host, goal.field);
	const after = projectedValue(goal, changes);
	const beforeDistance = valueDistance(before, goal.value);
	const afterDistance = valueDistance(after, goal.value);

	switch (goal.kind) {
		case 'approach':
		case 'maintain':
			return (beforeDistance - afterDistance) * goal.weight;
		case 'prevent':
			return (afterDistance - beforeDistance) * goal.weight;
	}
}

function teamOfEntity(
	combat: CombatState,
	entity: CombatEntity,
): AwarenessTeam | null {
	if (combat.entities.party.some((member) => member.id === entity.id)) {
		return 'party';
	}
	if (combat.entities.encounters.some((member) => member.id === entity.id)) {
		return 'encounters';
	}
	return null;
}

function alliesOf(
	combat: CombatState,
	entity: CombatEntity,
): Array<CombatEntity> {
	const team = teamOfEntity(combat, entity);
	if (!team) {
		return [];
	}
	return combat.entities[team].filter((candidate) => !candidate.isDead);
}

function enemiesOf(
	combat: CombatState,
	entity: CombatEntity,
): Array<CombatEntity> {
	const team = teamOfEntity(combat, entity);
	if (!team) {
		return [];
	}
	const enemyTeam = team === 'party' ? 'encounters' : 'party';
	return combat.entities[enemyTeam].filter((candidate) => !candidate.isDead);
}

function visibleMovesForAwareness(
	combat: CombatState,
	awarenessTeam: AwarenessTeam,
	subject: CombatEntity,
): Array<CombatMove> {
	const subjectTeam = teamOfEntity(combat, subject);
	if (subjectTeam === awarenessTeam) {
		return subject.moves;
	}
	return subject.moves.filter((move) => move.isHidden === false);
}

function currentRoundOrder(
	combat: CombatState,
): Array<CombatEntity> {
	const orderedTeams = combat.hasPriority === 'party'
		? [combat.entities.party, combat.entities.encounters]
		: [combat.entities.encounters, combat.entities.party];

	return orderedTeams
		.flatMap((team) => team)
		.filter((entity) => !entity.isDead);
}

function predictiveTurnQueue(
	combat: CombatState,
	currentActor: CombatEntity,
	depth: number,
): Array<string> {
	if (depth <= 0) {
		return [];
	}

	const roundOrder = currentRoundOrder(combat).map((entity) => entity.id);
	const currentIndex = roundOrder.indexOf(currentActor.id);
	if (currentIndex < 0 || roundOrder.length <= 1) {
		return [];
	}

	const rotated = [
		...roundOrder.slice(currentIndex + 1),
		...roundOrder.slice(0, currentIndex),
	];
	if (rotated.length === 0) {
		return [];
	}

	const queue: Array<string> = [];
	for (let i = 0; i < depth; i += 1) {
		queue.push(rotated[i % rotated.length]);
	}
	return queue;
}

function nextActorFromQueue(
	combat: CombatState,
	queue: Array<string>,
): {
	actor: CombatEntity | null;
	remaining: Array<string>;
} {
	for (let index = 0; index < queue.length; index += 1) {
		const actorId = queue[index];
		const actor = [...combat.entities.party, ...combat.entities.encounters].find(
			(entity) => entity.id === actorId && !entity.isDead,
		) ?? null;
		if (actor) {
			return {
				actor,
				remaining: queue.slice(index + 1),
			};
		}
	}

	return {
		actor: null,
		remaining: [],
	};
}

function focusChoice(
	entity: CombatEntity,
): TurnChoice {
	return {
		move: {
			id: `focus:${entity.id}`,
			name: 'Focus',
			description: 'Skip turn and gain 1 energy.',
			isHidden: false,
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
			canBeChainedInto: false,
			ignoresStatuses: ['sleep', 'anger', 'stun'],
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

function movementChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<TurnChoice> {
	const team = teamOfEntity(combat, entity);
	if (!team) {
		return [];
	}

	const teamEntities = combat.entities[team];
	const currentIndex = teamEntities.findIndex(
		(member) => member.id === entity.id,
	);
	if (currentIndex < 0) {
		return [];
	}

	const choices: Array<TurnChoice> = [];
	for (let index = 0; index < teamEntities.length; index += 1) {
		if (index === currentIndex) {
			continue;
		}
		choices.push({
			move: {
				id: `move:${entity.id}:${index}`,
				name: 'Reposition',
				description: 'Move to a new position in the team order.',
				isHidden: false,
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
				canBeChainedInto: false,
				ignoresStatuses: [],
				operations: [
					operation(moveEntity, {
						ctx: { entityIndex: index },
						targets: selfTargets(),
					}),
				],
				loopOperations: [],
			},
			targets: entityTargets(entity),
		});
	}
	return choices;
}

function combinations<T>(
	items: Array<T>,
	size: number,
): Array<Array<T>> {
	if (size === 0) {
		return [[]];
	}
	if (size > items.length) {
		return [];
	}
	if (size === 1) {
		return items.map((item) => [item]);
	}

	const result: Array<Array<T>> = [];
	for (let index = 0; index <= items.length - size; index += 1) {
		const head = items[index];
		for (const tail of combinations(items.slice(index + 1), size - 1)) {
			result.push([head, ...tail]);
		}
	}
	return result;
}

function targetMatricesForMove(
	combat: CombatState,
	caster: CombatEntity,
	move: CombatMove,
): Array<TargetMatrix> {
	const [minTargets, maxTargets] = move.targetType.range;
	const maxCount = Math.max(minTargets, maxTargets);

	switch (move.targetType.type) {
		case 'self':
			return [entityTargets(caster)];
		case 'ally': {
			const allies = alliesOf(combat, caster).filter(
				(ally) => ally.id !== caster.id,
			);
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, allies.length); count += 1) {
				for (const combo of combinations(allies, count)) {
					matrices.push(makeTargets({ entities: combo }));
				}
			}
			return matrices;
		}
		case 'enemy': {
			const enemies = enemiesOf(combat, caster);
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, enemies.length); count += 1) {
				for (const combo of combinations(enemies, count)) {
					matrices.push(makeTargets({ entities: combo }));
				}
			}
			return matrices;
		}
		case 'entity': {
			const allEntities = [...alliesOf(combat, caster), ...enemiesOf(combat, caster)];
			const unique = allEntities.filter(
				(entity, index, array) =>
					array.findIndex((candidate) => candidate.id === entity.id) === index,
			);
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, unique.length); count += 1) {
				for (const combo of combinations(unique, count)) {
					matrices.push(makeTargets({ entities: combo }));
				}
			}
			return matrices;
		}
		case 'move':
		case 'blessing':
			if (minTargets === 0) {
				return [emptyTargets()];
			}
			return [];
	}
}

function revealChoiceChanges(
	choice: TurnChoice,
): Array<StateChange> {
	if (choice.move.isHidden === false) {
		return [];
	}

	return [{
		host: choice.move,
		field: ['isHidden'],
		before: true,
		after: false,
		signal: `move.revealed.${choice.move.id}`,
	}];
}

function previewChoiceChanges(
	combat: CombatState,
	entity: CombatEntity,
	choice: TurnChoice,
): Array<StateChange> {
	const previewSequence = previewOperations(
		choice.move.operations,
		baseOperationContext(
			combat,
			entity,
			choice.move,
			choice.targets,
		),
	);
	return mergeStateChanges([
		...(previewSequence[previewSequence.length - 1] ?? []),
		...revealChoiceChanges(choice),
	]);
}

function rollbackStateChanges(
	changes: Array<StateChange>,
): void {
	for (const change of [...changes].reverse()) {
		applyStateChange({
			host: change.host,
			field: [...change.field],
			before: change.after,
			after: change.before,
		});
	}
}

function scoreChoiceBias(
	entity: CombatEntity,
	choice: TurnChoice,
): number {
	let score = 0;

	if (choice.isFocus) {
		score -= 0.05;
	}
	if (choice.move.id.startsWith('move:')) {
		score -= entity.aiTuning.positioning;
	}

	return score;
}

function goalContributionsForEntity(
	entity: CombatEntity,
	changes: Array<StateChange>,
): Array<GoalContribution> {
	return entity.goals
		.map((goal) => ({
			goal,
			score: scoreGoal(goal, changes),
		}))
		.filter(({ score }) => score !== 0)
		.sort((left, right) => Math.abs(right.score) - Math.abs(left.score));
}

function scoreChangesForEntity(
	entity: CombatEntity,
	changes: Array<StateChange>,
): number {
	return entity.goals.reduce(
		(total, goal) => total + scoreGoal(goal, changes),
		0,
	);
}

function moveChoices(
	combat: CombatState,
	actor: CombatEntity,
	awarenessTeam: AwarenessTeam,
): Array<TurnChoice> {
	const choices: Array<TurnChoice> = [];

	for (const move of visibleMovesForAwareness(combat, awarenessTeam, actor)) {
		if (move.cooldownTurns > 0) {
			continue;
		}

		const targetOptions = targetMatricesForMove(combat, actor, move);
		for (const targets of targetOptions) {
			const choice: TurnChoice = { move, targets };
			if (turnChoiceDisqualified(actor, choice)) {
				continue;
			}
			choices.push(choice);
		}
	}

	return choices;
}

function availableChoicesForAwareness(
	combat: CombatState,
	actor: CombatEntity,
	awarenessTeam: AwarenessTeam,
): Array<TurnChoice> {
	return [
		...moveChoices(combat, actor, awarenessTeam),
		...movementChoices(combat, actor),
		focusChoice(actor),
	].filter((choice) => !turnChoiceDisqualified(actor, choice));
}

function goalSignature(
	entity: CombatEntity,
): string {
	return entity.goals
		.map((goal) =>
			`${goal.id}:${goal.kind}:${goal.field.join('.')}:${String(goal.value)}:${goal.weight}`,
		)
		.join(',');
}

function entityStateSignature(
	entity: CombatEntity,
): string {
	const attunements = DamageElements.map((element) =>
		`${Number(entity.attunedTo[element])}:${entity.turnsAttuned[element]}`,
	).join(',');
	const statuses = Statuses.map((status) =>
		[
			Number(entity.hasStatus[status]),
			entity.statusTurns[status],
			entity.statusMaxTurns[status],
			entity.ignoresStatusTurns[status],
		].join(':'),
	).join(',');
	const moves = entity.moves.map((move) =>
		`${move.id}:${Number(move.isHidden)}:${move.cooldownTurns}:${Number(move.isBound)}`,
	).join(',');
	const blessings = entity.blessings.map((blessing) =>
		`${blessing.id}:${Number(blessing.isHidden)}:${blessing.cooldownTurns}:${Number(blessing.isExhausted)}:${Number(blessing.isBound)}`,
	).join(',');

	return [
		entity.id,
		entity.entityType,
		entity.level,
		entity.hp,
		entity.maxHp,
		entity.energy,
		entity.maxEnergy,
		entity.shields,
		entity.extraIterations,
		Number(entity.isDead),
		Number(entity.shieldsBroken),
		Number(entity.isBloody),
		entity.curseChance,
		entity.dodges,
		entity.maxDamageTaken,
		entity.lastDamageTaken,
		entity.totalDamageTaken,
		attunements,
		statuses,
		moves,
		blessings,
		goalSignature(entity),
	].join('|');
}

function combatStateSignature(
	combat: CombatState,
): string {
	const partyOrder = combat.entities.party.map((entity) => entity.id).join(',');
	const encounterOrder = combat.entities.encounters.map((entity) => entity.id).join(',');

	return [
		combat.turn,
		combat.hasPriority,
		partyOrder,
		encounterOrder,
		combat.entities.party.map(entityStateSignature).join('||'),
		combat.entities.encounters.map(entityStateSignature).join('||'),
	].join('###');
}

function ensureAiPredictionCache(
	combat: CombatState,
): AiPredictionCache {
	const currentSignature = combatStateSignature(combat);
	if (!combat.aiCache) {
		combat.aiCache = createAiPredictionCache(currentSignature);
		return combat.aiCache;
	}

	if (combat.aiCache.currentSignature !== currentSignature) {
		setAiPredictionCacheRoot(combat.aiCache, currentSignature);
		pruneAiPredictionCache(combat.aiCache, currentSignature);
	}

	return combat.aiCache;
}

function warmStateChoiceCatalogs(
	combat: CombatState,
	cache: AiPredictionCache,
	signature: string = combatStateSignature(combat),
): void {
	getStateChoiceCatalog(combat, cache, 'party', signature);
	getStateChoiceCatalog(combat, cache, 'encounters', signature);
}

function buildStateChoiceCatalog(
	combat: CombatState,
	awarenessTeam: AwarenessTeam,
	signature: string,
): StateChoiceCatalog {
	const actorChoices = new Map<string, Array<ProjectedChoice>>();
	const actors = [
		...combat.entities.party,
		...combat.entities.encounters,
	].filter((entity) => !entity.isDead);

	for (const actor of actors) {
		const choices = availableChoicesForAwareness(combat, actor, awarenessTeam);
		actorChoices.set(
			actor.id,
			choices.map((choice) => ({
				choice,
				immediateChanges: previewChoiceChanges(combat, actor, choice),
				bias: scoreChoiceBias(actor, choice),
			})),
		);
	}

	return {
		signature,
		actorChoices,
	};
}

function getStateChoiceCatalog(
	combat: CombatState,
	cache: AiPredictionCache,
	awarenessTeam: AwarenessTeam,
	signature = combatStateSignature(combat),
): StateChoiceCatalog {
	const catalogs = cache.catalogs[awarenessTeam];
	let catalog = catalogs.get(signature);
	if (!catalog) {
		catalog = buildStateChoiceCatalog(combat, awarenessTeam, signature);
		catalogs.set(signature, catalog);
	}
	return catalog;
}

function getStateBranchBucket(
	cache: AiPredictionCache,
	awarenessTeam: AwarenessTeam,
	signature: string,
): Map<string, BranchPrediction> {
	const stateBranches = cache.branches[awarenessTeam].get(signature);
	if (stateBranches) {
		return stateBranches;
	}

	const created = new Map<string, BranchPrediction>();
	cache.branches[awarenessTeam].set(signature, created);
	return created;
}

function branchPredictionKey(
	actor: CombatEntity,
	remainingQueue: Array<string>,
): string {
	return `${actor.id}::${remainingQueue.join('>')}`;
}

function predictBestBranch(
	combat: CombatState,
	awarenessTeam: AwarenessTeam,
	actor: CombatEntity,
	remainingQueue: Array<string>,
	cache: AiPredictionCache,
): BranchPrediction {
	const signature = combatStateSignature(combat);
	const key = branchPredictionKey(actor, remainingQueue);
	const branches = getStateBranchBucket(cache, awarenessTeam, signature);
	const cached = branches.get(key);
	if (cached) {
		return cached;
	}

	const catalog = getStateChoiceCatalog(combat, cache, awarenessTeam, signature);
	const projections = catalog.actorChoices.get(actor.id) ?? [];
	if (projections.length === 0) {
		const empty = { changes: [], utility: 0 };
		branches.set(key, empty);
		return empty;
	}

	let bestBranch: BranchPrediction | null = null;

	for (const projection of projections) {
		const parentSignature = signature;
		const applied = applyStateChanges(projection.immediateChanges);
		const childSignature = combatStateSignature(combat);
		recordAiPredictionChild(
			cache,
			parentSignature,
			childSignature,
		);
		warmStateChoiceCatalogs(
			combat,
			cache,
			childSignature,
		);

		let futureChanges: Array<StateChange> = [];
		const next = nextActorFromQueue(combat, remainingQueue);
		if (next.actor) {
			futureChanges = predictBestBranch(
				combat,
				awarenessTeam,
				next.actor,
				next.remaining,
				cache,
			).changes;
		}

		const combined = mergeStateChanges([
			...projection.immediateChanges,
			...futureChanges,
		]);

		rollbackStateChanges(applied);

		const utility =
			scoreChangesForEntity(actor, combined) +
			projection.bias;

		if (!bestBranch || utility > bestBranch.utility) {
			bestBranch = {
				changes: combined,
				utility,
			};
		}
	}

	const resolved = bestBranch ?? { changes: [], utility: 0 };
	branches.set(key, resolved);
	return resolved;
}

export function primeAiPredictionCache(
	combat: CombatState,
): void {
	const cache = ensureAiPredictionCache(combat);
	warmStateChoiceCatalogs(combat, cache, cache.currentSignature);
}

export { markAiPredictionCacheDirty };

export function analyzeTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<ChoiceAnalysis> {
	const awarenessTeam = teamOfEntity(combat, entity);
	if (!awarenessTeam || entity.isDead) {
		return [];
	}

	const cache = ensureAiPredictionCache(combat);
	const futureQueue = predictiveTurnQueue(
		combat,
		entity,
		Math.max(0, entity.level - 1),
	);
	const catalog = getStateChoiceCatalog(
		combat,
		cache,
		awarenessTeam,
		cache.currentSignature,
	);
	const projections = catalog.actorChoices.get(entity.id) ?? [];

	const ranked = projections.map((projection) => {
		const parentSignature = cache.currentSignature;
		const applied = applyStateChanges(projection.immediateChanges);
		const childSignature = combatStateSignature(combat);
		recordAiPredictionChild(
			cache,
			parentSignature,
			childSignature,
		);
		warmStateChoiceCatalogs(
			combat,
			cache,
			childSignature,
		);

		let futureChanges: Array<StateChange> = [];
		const next = nextActorFromQueue(combat, futureQueue);
		if (next.actor) {
			futureChanges = predictBestBranch(
				combat,
				awarenessTeam,
				next.actor,
				next.remaining,
				cache,
			).changes;
		}

		const combined = mergeStateChanges([
			...projection.immediateChanges,
			...futureChanges,
		]);
		rollbackStateChanges(applied);

		const contributions = goalContributionsForEntity(entity, combined);
		const score =
			scoreChangesForEntity(entity, combined) +
			projection.bias;

		return {
			choice: projection.choice,
			score,
			contributions,
			predictedChanges: combined,
			futureActorIds: [...futureQueue],
		};
	});

	ranked.sort((left, right) => right.score - left.score);
	return ranked;
}

export function calculateTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<TurnChoice> {
	return analyzeTurnChoices(combat, entity).map(({ choice }) => choice);
}
