// src/combat/ai/turnChoice.ts

import { DamageElements, ElementRelationships, Statuses } from '../../shared/index.ts';

import type { Goal } from './types.ts';
import type { CombatTeam } from '../../shared';
import type {
	AiPredictionCache,
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

interface EntityScoreSummary {
	total: number;
	contributions: Array<GoalContribution>;
}

type GoalFieldIndex = WeakMap<object, Map<string, Array<Goal>>>;
type StateAnalysisCache = Map<string, Map<string, Array<ChoiceAnalysis>>>;

const goalFieldIndexCache = new WeakMap<CombatEntity, Map<string, GoalFieldIndex>>();

const analysisCache = new WeakMap<AiPredictionCache, StateAnalysisCache>();

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

function fieldPathKey(
	field: Array<string>,
): string {
	return field.join('.');
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

function scoreGoalAfter(
	goal: Goal,
	after: unknown,
): number {
	const before = readPath(goal.host, goal.field);
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

function resolveForesight(
	entity: CombatEntity,
): number {
	if (entity.aiTuning.foresight != null) {
		return Math.max(0, entity.aiTuning.foresight);
	}
	return Math.max(0, entity.level - 1);
}

function resolveGoalWidth(
	entity: CombatEntity,
): number | null {
	if (entity.aiTuning.goalWidth == null || entity.aiTuning.goalWidth <= 0) {
		return null;
	}
	return entity.aiTuning.goalWidth;
}

function resolveGoalWeightRolloff(
	entity: CombatEntity,
): number {
	if (entity.aiTuning.goalWeightRolloff == null) {
		return 1;
	}
	return Math.max(0, Math.min(1, entity.aiTuning.goalWeightRolloff));
}

function teamOfEntity(
	combat: CombatState,
	entity: CombatEntity,
): CombatTeam | null {
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
	awarenessTeam: CombatTeam,
	subject: CombatEntity,
): Array<CombatMove> {
	const subjectTeam = teamOfEntity(combat, subject);
	if (subjectTeam === awarenessTeam) {
		return subject.moves;
	}
	return subject.moves.filter((move) => move.isHidden === false);
}

function targetableMovesForAwareness(
	combat: CombatState,
	_subjectTeam: CombatTeam,
	subject: CombatEntity,
): Array<CombatMove> {
	return subject.moves.filter((move) => move.isHidden === false);
}

function visibleBlessingsForAwareness(
	combat: CombatState,
	awarenessTeam: CombatTeam,
	subject: CombatEntity,
) {
	const subjectTeam = teamOfEntity(combat, subject);
	if (subjectTeam === awarenessTeam) {
		return subject.blessings;
	}
	return subject.blessings.filter((blessing) => blessing.isHidden === false);
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
			isBanked: false,
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
				isBanked: false,
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
	awarenessTeam: CombatTeam,
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
		case 'friend': {
			const friends = alliesOf(combat, caster);
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, friends.length); count += 1) {
				for (const combo of combinations(friends, count)) {
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
		case 'move': {
			const knownMoves = [
				...combat.entities.party,
				...combat.entities.encounters,
			].flatMap((entity) => targetableMovesForAwareness(combat, awarenessTeam, entity));
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, knownMoves.length); count += 1) {
				for (const combo of combinations(knownMoves, count)) {
					matrices.push(makeTargets({ moves: combo }));
				}
			}
			return matrices;
		}
		case 'blessing': {
			const knownBlessings = [
				...combat.entities.party,
				...combat.entities.encounters,
			].flatMap((entity) => visibleBlessingsForAwareness(combat, awarenessTeam, entity));
			const matrices: Array<TargetMatrix> = [];
			for (let count = minTargets; count <= Math.min(maxCount, knownBlessings.length); count += 1) {
				for (const combo of combinations(knownBlessings, count)) {
					matrices.push(makeTargets({ blessings: combo }));
				}
			}
			return matrices;
		}
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

function goalsSignature(
	goals: Array<Goal>,
): string {
	return goals
		.map((goal) =>
			`${goal.id}:${goal.kind}:${goal.field.join('.')}:${String(goal.value)}:${goal.weight}`,
		)
		.join(',');
}

function goalPriority(
	goal: Goal,
): number {
	const current = readPath(goal.host, goal.field);
	const distance = valueDistance(current, goal.value);

	if (goal.kind === 'prevent') {
		return goal.weight / (distance + 1);
	}

	if (
		typeof current === 'number' &&
		typeof goal.value === 'number' &&
		goal.value > current
	) {
		return goal.weight * (distance + 1);
	}

	if (goal.kind === 'maintain' && distance > 0) {
		return goal.weight * (distance + 1);
	}

	return goal.weight / (distance + 1);
}

function selectEvaluationGoals(
	entity: CombatEntity,
): Array<Goal> {
	const width = resolveGoalWidth(entity);
	if (!width || entity.goals.length <= width) {
		return entity.goals;
	}

	return [...entity.goals]
		.sort((left, right) => goalPriority(right) - goalPriority(left))
		.slice(0, width);
}

function buildGoalFieldIndex(
	goals: Array<Goal>,
): GoalFieldIndex {
	const index: GoalFieldIndex = new WeakMap();
	for (const goal of goals) {
		const host = goal.host as object;
		const hostMap = index.get(host) ?? new Map<string, Array<Goal>>();
		const key = fieldPathKey(goal.field);
		const goalsAtField = hostMap.get(key) ?? [];
		goalsAtField.push(goal);
		hostMap.set(key, goalsAtField);
		index.set(host, hostMap);
	}
	return index;
}

function getGoalFieldIndex(
	entity: CombatEntity,
	goals: Array<Goal>,
): GoalFieldIndex {
	const signature = goalsSignature(goals);
	const cached = goalFieldIndexCache.get(entity);
	if (cached?.has(signature)) {
		return cached.get(signature) as GoalFieldIndex;
	}

	const index = buildGoalFieldIndex(goals);
	const signatures = cached ?? new Map<string, GoalFieldIndex>();
	signatures.set(signature, index);
	goalFieldIndexCache.set(entity, signatures);
	return index;
}

function summarizeEntityScore(
	entity: CombatEntity,
	changes: Array<StateChange>,
	goals: Array<Goal> = selectEvaluationGoals(entity),
): EntityScoreSummary {
	const index = getGoalFieldIndex(entity, goals);
	const scored = new Map<string, GoalContribution>();

	for (const change of changes) {
		const hostMap = index.get(change.host as object);
		if (!hostMap) {
			continue;
		}

		const goals = hostMap.get(fieldPathKey(change.field));
		if (!goals) {
			continue;
		}

		for (const goal of goals) {
			const score = scoreGoalAfter(goal, change.after);
			if (score === 0) {
				scored.delete(goal.id);
				continue;
			}

			scored.set(goal.id, {
				goal,
				score,
			});
		}
	}

	const contributions = [...scored.values()]
		.sort((left, right) => Math.abs(right.score) - Math.abs(left.score));

	return {
		total: contributions.reduce(
			(total, contribution) => total + contribution.score,
			0,
		),
		contributions,
	};
}

function summarizeGoalTimeline(
	entity: CombatEntity,
	timeline: Array<Array<StateChange>>,
	goals: Array<Goal> = selectEvaluationGoals(entity),
): EntityScoreSummary {
	const contributions = new Map<string, GoalContribution>();
	let cumulative: Array<StateChange> = [];
	let total = 0;
	let weight = 1;
	const rolloff = resolveGoalWeightRolloff(entity);

	for (const step of timeline) {
		cumulative = mergeStateChanges([
			...cumulative,
			...step,
		]);

		const summary = summarizeEntityScore(entity, cumulative, goals);
		total += summary.total * weight;

		for (const contribution of summary.contributions) {
			const existing = contributions.get(contribution.goal.id);
			if (existing) {
				existing.score += contribution.score * weight;
				continue;
			}
			contributions.set(contribution.goal.id, {
				goal: contribution.goal,
				score: contribution.score * weight,
			});
		}

		weight *= rolloff;
	}

	return {
		total,
		contributions: [...contributions.values()].sort(
			(left, right) => Math.abs(right.score) - Math.abs(left.score),
		),
	};
}

function moveHasOperation(
	move: CombatMove,
	names: Array<string>,
): boolean {
	return [...move.operations, ...move.loopOperations].some((operation) =>
		names.includes(operation.name),
	);
}

function moveAppliesElementToOwner(
	move: CombatMove,
	element: string,
): boolean {
	return move.element === element &&
		moveHasOperation(move, ['applyAttunement']) &&
		move.targetType.type === 'enemy';
}

function attunementInteractionPressure(
	combat: CombatState,
	awarenessTeam: CombatTeam,
	target: CombatEntity,
	attunement: string,
): number {
	let pressure = 0;
	const awareEntities = combat.entities[awarenessTeam].filter(
		(entity) => entity.isDead === false,
	);

	for (const entity of awareEntities) {
		for (const move of visibleMovesForAwareness(combat, awarenessTeam, entity)) {
			const relation = ElementRelationships[move.element]?.[attunement as keyof typeof ElementRelationships[typeof move.element]];
			switch (relation) {
				case 'blocks':
					pressure += 2;
					break;
				case 'absorbs':
					pressure += 1.5;
					break;
				case 'resists':
					pressure += 1;
					break;
				case 'weak':
					pressure -= 0.5;
					break;
			}
		}
	}

	for (const move of visibleMovesForAwareness(combat, awarenessTeam, target)) {
		if (moveAppliesElementToOwner(move, attunement)) {
			pressure -= 1.5;
		}
	}

	return pressure;
}

function stateInteractionHeuristic(
	combat: CombatState,
	actor: CombatEntity,
	awarenessTeam: CombatTeam,
	changes: Array<StateChange>,
): number {
	let score = 0;

	for (const change of changes) {
		if (!('entityType' in change.host)) {
			continue;
		}

		if (
			change.field[0] === 'attunedTo' &&
			typeof change.field[1] === 'string'
		) {
			const attunement = change.field[1];
			const pressure = attunementInteractionPressure(
				combat,
				awarenessTeam,
				change.host,
				attunement,
			);
			if (change.before === true && change.after === false) {
				score += pressure;
			}
			if (change.before === false && change.after === true) {
				score -= pressure * 0.5;
			}
		}

		if (change.field[0] === 'statusTurns') {
			if (change.host.id === actor.id && typeof change.after === 'number' && typeof change.before === 'number') {
				score += (change.after - change.before) * -0.25;
			}
			if (change.host.id !== actor.id && typeof change.after === 'number' && typeof change.before === 'number') {
				score += (change.after - change.before) * 0.2;
			}
		}
	}

	return score;
}

function heuristicProjectionScore(
	combat: CombatState,
	actor: CombatEntity,
	awarenessTeam: CombatTeam,
	projection: ProjectedChoice,
	goals: Array<Goal>,
): number {
	return projection.bias +
		(projection.choice.move.baseDamage * 0.25) +
		summarizeEntityScore(actor, projection.immediateChanges, goals).total +
		stateInteractionHeuristic(
			combat,
			actor,
			awarenessTeam,
			projection.immediateChanges,
		);
}

function isStatefulUtilityChoice(
	choice: TurnChoice,
): boolean {
	return choice.move.moveType === 'utility' ||
		moveHasOperation(choice.move, [
			'applyStatusTurns',
			'extendStatusTurns',
			'negateStatus',
			'reduceStatusTurns',
			'applyAttunement',
			'negateAttunement',
			'negateCooldown',
			'negateExtraIterations',
			'bindMoves',
			'applyIgnoreStatusTurns',
			'heal',
			'applyShields',
			'applyEnergy',
		]);
}

function deepSearchCandidateLimit(
	entity: CombatEntity,
	totalChoices: number,
): number {
	const foresight = resolveForesight(entity);
	return Math.min(
		totalChoices,
		Math.max(
			4,
			foresight + 2,
			Math.ceil(Math.sqrt(totalChoices)) + 1,
		),
	);
}

function selectDeepSearchProjections(
	combat: CombatState,
	actor: CombatEntity,
	awarenessTeam: CombatTeam,
	projections: Array<ProjectedChoice>,
	goals: Array<Goal>,
): Set<ProjectedChoice> {
	const limit = deepSearchCandidateLimit(actor, projections.length);
	if (limit >= projections.length) {
		return new Set(projections);
	}

	const ranked = [...projections].sort(
		(left, right) =>
			heuristicProjectionScore(combat, actor, awarenessTeam, right, goals) -
			heuristicProjectionScore(combat, actor, awarenessTeam, left, goals),
	);
	const reservedUtility = Math.min(2, limit);
	const selected = new Set<ProjectedChoice>();

	for (const projection of ranked.filter(({ choice }) => isStatefulUtilityChoice(choice)).slice(0, reservedUtility)) {
		selected.add(projection);
	}
	for (const projection of ranked) {
		if (selected.size >= limit) {
			break;
		}
		selected.add(projection);
	}

	return selected;
}

function moveChoices(
	combat: CombatState,
	actor: CombatEntity,
	awarenessTeam: CombatTeam,
): Array<TurnChoice> {
	const choices: Array<TurnChoice> = [];

	for (const move of visibleMovesForAwareness(combat, awarenessTeam, actor)) {
		if (move.cooldownTurns > 0) {
			continue;
		}

		const targetOptions = targetMatricesForMove(combat, actor, awarenessTeam, move);
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
	awarenessTeam: CombatTeam,
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
		`${move.id}:${Number(move.isHidden)}:${move.cooldownTurns}:${Number(move.isBound)}:${Number(move.isBanked)}`,
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
		pruneStateAnalysisCache(combat.aiCache, currentSignature);
	}

	return combat.aiCache;
}

function pruneStateAnalysisCache(
	cache: AiPredictionCache,
	currentSignature: string,
): void {
	const stateCaches = analysisCache.get(cache);
	if (!stateCaches) {
		return;
	}

	const reachable = new Set<string>([currentSignature]);
	for (const awarenessTeam of ['party', 'encounters'] as const) {
		for (const signature of cache.catalogs[awarenessTeam].keys()) {
			reachable.add(signature);
		}
		for (const signature of cache.branches[awarenessTeam].keys()) {
			reachable.add(signature);
		}
	}

	for (const signature of [...stateCaches.keys()]) {
		if (!reachable.has(signature)) {
			stateCaches.delete(signature);
		}
	}

	analysisCache.set(cache, stateCaches);
}

function getStateAnalysisCache(
	cache: AiPredictionCache,
	signature: string,
): Map<string, Array<ChoiceAnalysis>> {
	const stateCaches = analysisCache.get(cache) ?? new Map();
	let actorCache = stateCaches.get(signature);
	if (!actorCache) {
		actorCache = new Map();
		stateCaches.set(signature, actorCache);
		analysisCache.set(cache, stateCaches);
	}
	return actorCache;
}

function planningEntities(
	combat: CombatState,
): Array<CombatEntity> {
	return [
		...combat.entities.encounters,
		...combat.entities.party,
	].filter((entity) => entity.isDead === false);
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
	awarenessTeam: CombatTeam,
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
	awarenessTeam: CombatTeam,
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
	awarenessTeam: CombatTeam,
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
	awarenessTeam: CombatTeam,
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
	const goals = selectEvaluationGoals(actor);
	if (projections.length === 0) {
		const empty = { changes: [], utility: 0, timeline: [] };
		branches.set(key, empty);
		return empty;
	}

	const deepCandidates = selectDeepSearchProjections(
		combat,
		actor,
		awarenessTeam,
		projections,
		goals,
	);
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
		let futureTimeline: Array<Array<StateChange>> = [];
		const next = nextActorFromQueue(combat, remainingQueue);
		if (next.actor && deepCandidates.has(projection)) {
			const futurePrediction = predictBestBranch(
				combat,
				awarenessTeam,
				next.actor,
				next.remaining,
				cache,
			);
			futureChanges = futurePrediction.changes;
			futureTimeline = futurePrediction.timeline;
		}

		const timeline = [
			projection.immediateChanges,
			...futureTimeline,
		];
		const combined = mergeStateChanges([
			...projection.immediateChanges,
			...futureChanges,
		]);

		rollbackStateChanges(applied);

		const utility =
			summarizeGoalTimeline(actor, timeline, goals).total +
			projection.bias;

		if (!bestBranch || utility > bestBranch.utility) {
			bestBranch = {
				changes: combined,
				utility,
				timeline,
			};
		}
	}

	const resolved = bestBranch ?? { changes: [], utility: 0, timeline: [] };
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

function analyzeTurnChoicesForEntity(
	combat: CombatState,
	entity: CombatEntity,
	cache: AiPredictionCache,
): Array<ChoiceAnalysis> {
	const awarenessTeam = teamOfEntity(combat, entity);
	if (!awarenessTeam || entity.isDead) {
		return [];
	}

	const futureQueue = predictiveTurnQueue(
		combat,
		entity,
		resolveForesight(entity),
	);
	const catalog = getStateChoiceCatalog(
		combat,
		cache,
		awarenessTeam,
		cache.currentSignature,
	);
	const projections = catalog.actorChoices.get(entity.id) ?? [];
	const goals = selectEvaluationGoals(entity);
	const deepCandidates = selectDeepSearchProjections(
		combat,
		entity,
		awarenessTeam,
		projections,
		goals,
	);

	const ranked = projections.map((projection) => {
		const parentSignature = cache.currentSignature;
		const applied = applyStateChanges(projection.immediateChanges);
		const childSignature = combatStateSignature(combat);
		recordAiPredictionChild(cache, parentSignature, childSignature);
		warmStateChoiceCatalogs(combat, cache, childSignature);

		let futureChanges: Array<StateChange> = [];
		let futureTimeline: Array<Array<StateChange>> = [];
		const next = nextActorFromQueue(combat, futureQueue);
		if (next.actor && deepCandidates.has(projection)) {
			const futurePrediction = predictBestBranch(
				combat,
				awarenessTeam,
				next.actor,
				next.remaining,
				cache,
			);
			futureChanges = futurePrediction.changes;
			futureTimeline = futurePrediction.timeline;
		}
		const timeline = [
			projection.immediateChanges,
			...futureTimeline,
		];
		const combined = mergeStateChanges([
			...projection.immediateChanges,
			...futureChanges,
		]);
		rollbackStateChanges(applied);
		const scoreSummary = summarizeGoalTimeline(entity, timeline, goals);
		const score =
			scoreSummary.total +
			projection.bias;
		return {
			choice: projection.choice,
			score,
			contributions: scoreSummary.contributions,
			predictedChanges: combined,
			futureActorIds: deepCandidates.has(projection)
				? [...futureQueue]
				: [],
		};
	});
	ranked.sort((left, right) => right.score - left.score);
	return ranked;
}

export function analyzeAllTurnChoices(
	combat: CombatState,
): Map<string, Array<ChoiceAnalysis>> {
	const cache = ensureAiPredictionCache(combat);
	const stateCache = getStateAnalysisCache(cache, cache.currentSignature);

	for (const entity of planningEntities(combat)) {
		if (!stateCache.has(entity.id)) {
			stateCache.set(
				entity.id,
				analyzeTurnChoicesForEntity(combat, entity, cache),
			);
		}
	}

	return stateCache;
}

export function analyzeTurnChoicesForEntities(
	combat: CombatState,
	entities: Array<CombatEntity>,
): Map<string, Array<ChoiceAnalysis>> {
	const cache = ensureAiPredictionCache(combat);
	const stateCache = getStateAnalysisCache(cache, cache.currentSignature);

	for (const entity of entities) {
		if (entity.isDead || stateCache.has(entity.id)) {
			continue;
		}
		stateCache.set(
			entity.id,
			analyzeTurnChoicesForEntity(combat, entity, cache),
		);
	}

	return new Map(
		entities.map((entity) => [entity.id, stateCache.get(entity.id) ?? []]),
	);
}

export function analyzeTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<ChoiceAnalysis> {
	return analyzeAllTurnChoices(combat).get(entity.id) ?? [];
}

export function calculateAllTurnChoices(
	combat: CombatState,
): Map<string, Array<TurnChoice>> {
	return new Map(
		[...analyzeAllTurnChoices(combat).entries()].map(
			([entityId, analyses]) => [
				entityId,
				analyses.map(
					({ choice }) => choice
				),
			]
		),
	);
}

export function calculateTurnChoices(
	combat: CombatState,
	entity: CombatEntity,
): Array<TurnChoice> {
	return analyzeTurnChoices(combat, entity).map(
		({ choice }) => choice
	);
}
