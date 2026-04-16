import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';

import {
	calculateAllTurnChoices,
	calculateAllTurnChoicesInWorkersDetailed,
	hydrateAiGoalListeners,
	hydrateCombatGoals,
	primeAiPredictionCache,
} from '../src/combat/ai/index.ts';
import { buildCombatState } from '../src/combat/constructor.ts';
import type {
	CombatEntity,
	TurnChoice,
} from '../src/combat/models/index.ts';
import type { CombatState } from '../src/combat/types.ts';
import {
	audit,
	cleanupEntity,
	executeTurnChoice,
	tickAttunements,
	tickCooldowns,
	tickIgnoresStatuses,
	tickListenerCharges,
	tickStatuses,
	turnChoiceDisqualified,
} from '../src/combat/turn/index.ts';
import {
	BasicAttackMoves,
	MoveTemplatesById,
	UtilityMoveTemplates,
	type MoveTemplate,
} from '../src/data/templates/move/index.ts';
import type { EntityTemplate } from '../src/data/templates/index.ts';
import type { Status } from '../src/shared/index.ts';

type CombatTeam = 'party' | 'encounters';
type BucketName = 'attack' | 'utility11' | 'utility21';
type PlannerName = 'serial' | 'workers';
type Winner = CombatTeam | 'draw';
type RemainingStatuses = Array<Exclude<Status, 'burn' | 'decay' | 'wound'>>;
type EntitySlotKey = 'attackOne' | 'attackTwo' | 'utilityOne' | 'utilityTwo';

const DEFAULT_OUTPUT_DIR = resolve('tests/output/ai-move-balance');
const DEFAULT_MAX_ROUNDS = 30;
const DEFAULT_COMBATS_PER_MATCHUP = 5;
const DEFAULT_FORESIGHT = 2;
const DEFAULT_PLANNER: PlannerName = 'workers';
const ENTITY_LEVEL = 3;
const ENTITY_HP = 18;
const ENTITY_ENERGY = 3;
const ENTITY_SHIELDS = 0;
const MATCHUPS_CSV = 'matchups.csv';
const MOVE_SUMMARY_CSV = 'move-summary.csv';
const MOVE_MATRIX_CSV = 'move-matrix.csv';
const COMBAT_LOG = 'combats.log';

const UtilityMoves11To17 = UtilityMoveTemplates.slice(0, 7);
const UtilityMoves21To27 = UtilityMoveTemplates.slice(7);

interface SweepOptions {
	combatsPerMatchup: number;
	concurrency: number;
	foresight: number;
	goalWeightRolloff: number | null;
	goalWidth: number | null;
	matchupLimit: number | null;
	maxRounds: number;
	outputDir: string;
	planner: PlannerName;
	verbose: boolean;
}

interface EntityLoadout {
	id: string;
	name: string;
	attackOne: MoveTemplate;
	attackTwo: MoveTemplate;
	utilityOne: MoveTemplate;
	utilityTwo: MoveTemplate;
}

interface TeamVariant {
	label: string;
	side: CombatTeam;
	signature: string;
	entities: [EntityLoadout, EntityLoadout];
}

interface SlotDescriptor {
	bucket: BucketName;
	key: EntitySlotKey;
	label: string;
}

interface Matchup {
	encounter: TeamVariant;
	id: string;
	index: number;
	party: TeamVariant;
}

interface PlannerBatch {
	choicesByEntityId: Map<string, Array<TurnChoice>>;
	planningMs: number;
}

interface CombatSimulationResult {
	combatIndex: number;
	log: Array<string>;
	roundsCompleted: number;
	totalElapsedMs: number;
	totalPlanningMs: number;
	winner: Winner;
}

interface MatchupResult {
	averageElapsedMs: number;
	averagePlanningMs: number;
	averageRounds: number;
	combats: Array<CombatSimulationResult>;
	draws: number;
	encounterVariant: TeamVariant;
	encountersWins: number;
	matchup: Matchup;
	partyWins: number;
	partyVariant: TeamVariant;
}

interface MoveSummaryStat {
	draws: number;
	losses: number;
	moveId: string;
	samples: number;
	wins: number;
}

interface MoveMatrixStat {
	draws: number;
	losses: number;
	moveId: string;
	opponentMoveId: string;
	samples: number;
	wins: number;
}

interface ProgressState {
	completedMatchups: number;
	moveMatrixStats: Map<string, MoveMatrixStat>;
	moveSummaryStats: Map<string, MoveSummaryStat>;
	startedAtMs: number;
	totalMatchups: number;
}

const SLOT_DESCRIPTORS: Array<SlotDescriptor> = [
	{ bucket: 'attack', key: 'attackOne', label: 'attack_1' },
	{ bucket: 'attack', key: 'attackTwo', label: 'attack_2' },
	{ bucket: 'utility11', key: 'utilityOne', label: 'utility_11_17' },
	{ bucket: 'utility21', key: 'utilityTwo', label: 'utility_21_27' },
];

const PartyBaseTeam = createBaseTeamVariant(
	'party',
	'base',
	[
		createEntityLoadout(
			'party_1',
			'Azure Knight',
			BasicAttackMoves[0],
			BasicAttackMoves[1],
			UtilityMoves11To17[0],
			UtilityMoves21To27[0],
		),
		createEntityLoadout(
			'party_2',
			'Granite Sage',
			BasicAttackMoves[2],
			BasicAttackMoves[3],
			UtilityMoves11To17[1],
			UtilityMoves21To27[1],
		),
	],
);

const EncounterBaseTeam = createBaseTeamVariant(
	'encounters',
	'base',
	[
		createEntityLoadout(
			'enc_1',
			'Rift Hound',
			BasicAttackMoves[4],
			BasicAttackMoves[5],
			UtilityMoves11To17[2],
			UtilityMoves21To27[2],
		),
		createEntityLoadout(
			'enc_2',
			'Tide Monk',
			BasicAttackMoves[6],
			BasicAttackMoves[0],
			UtilityMoves11To17[3],
			UtilityMoves21To27[3],
		),
	],
);

function createEntityLoadout(
	id: string,
	name: string,
	attackOne: MoveTemplate,
	attackTwo: MoveTemplate,
	utilityOne: MoveTemplate,
	utilityTwo: MoveTemplate,
): EntityLoadout {
	return {
		id,
		name,
		attackOne,
		attackTwo,
		utilityOne,
		utilityTwo,
	};
}

function createBaseTeamVariant(
	side: CombatTeam,
	label: string,
	entities: [EntityLoadout, EntityLoadout],
): TeamVariant {
	return {
		label,
		side,
		entities,
		signature: teamSignature(entities),
	};
}

function cloneEntityLoadout(
	entity: EntityLoadout,
): EntityLoadout {
	return {
		...entity,
	};
}

function cloneTeamEntities(
	entities: [EntityLoadout, EntityLoadout],
): [EntityLoadout, EntityLoadout] {
	return [
		cloneEntityLoadout(entities[0]),
		cloneEntityLoadout(entities[1]),
	];
}

function movePoolForBucket(
	bucket: BucketName,
): Array<MoveTemplate> {
	switch (bucket) {
		case 'attack':
			return BasicAttackMoves;
		case 'utility11':
			return UtilityMoves11To17;
		case 'utility21':
			return UtilityMoves21To27;
	}
}

function loadoutSignature(
	entity: EntityLoadout,
): string {
	return [
		entity.attackOne.id,
		entity.attackTwo.id,
		entity.utilityOne.id,
		entity.utilityTwo.id,
	].join(',');
}

function teamSignature(
	entities: [EntityLoadout, EntityLoadout],
): string {
	return entities.map(loadoutSignature).join('|');
}

function teamLoadoutLabel(
	variant: TeamVariant,
): string {
	return variant.entities
		.map((entity) =>
			`${entity.id}[${loadoutSignature(entity)}]`,
		)
		.join('|');
}

function teamMoveIds(
	variant: TeamVariant,
): Array<string> {
	return [...new Set(
		variant.entities.flatMap((entity) => [
			entity.attackOne.id,
			entity.attackTwo.id,
			entity.utilityOne.id,
			entity.utilityTwo.id,
		]),
	)];
}

function candidateAllowed(
	entity: EntityLoadout,
	key: EntitySlotKey,
	candidate: MoveTemplate,
): boolean {
	if (key === 'attackOne') {
		return candidate.id !== entity.attackTwo.id;
	}
	if (key === 'attackTwo') {
		return candidate.id !== entity.attackOne.id;
	}
	return true;
}

function createTeamVariants(
	base: TeamVariant,
): Array<TeamVariant> {
	const variants: Array<TeamVariant> = [base];
	const seen = new Set<string>([base.signature]);

	for (let entityIndex = 0; entityIndex < base.entities.length; entityIndex += 1) {
		for (const slot of SLOT_DESCRIPTORS) {
			const current = base.entities[entityIndex][slot.key];
			for (const candidate of movePoolForBucket(slot.bucket)) {
				if (candidate.id === current.id) {
					continue;
				}
				if (!candidateAllowed(base.entities[entityIndex], slot.key, candidate)) {
					continue;
				}

				const entities = cloneTeamEntities(base.entities);
				entities[entityIndex][slot.key] = candidate;
				const signature = teamSignature(entities);
				if (seen.has(signature)) {
					continue;
				}

				seen.add(signature);
				variants.push({
					label: `${entities[entityIndex].id}.${slot.label}=${candidate.id}`,
					side: base.side,
					entities,
					signature,
				});
			}
		}
	}

	return variants;
}

function createMatchups(
	partyVariants: Array<TeamVariant>,
	encounterVariants: Array<TeamVariant>,
	limit: number | null,
): Array<Matchup> {
	const matchups: Array<Matchup> = [];
	for (const party of partyVariants) {
		for (const encounter of encounterVariants) {
			matchups.push({
				id: `${party.signature}__vs__${encounter.signature}`,
				index: matchups.length + 1,
				party,
				encounter,
			});
		}
	}

	return limit == null
		? matchups
		: matchups.slice(0, Math.max(0, limit));
}

function createEntityTemplate(
	entity: EntityLoadout,
	options: SweepOptions,
): EntityTemplate {
	return {
		id: entity.id,
		name: entity.name,
		level: ENTITY_LEVEL,
		xp: 0,
		entityType: 'forecasted',
		hp: ENTITY_HP,
		maxHp: ENTITY_HP,
		energy: ENTITY_ENERGY,
		maxEnergy: ENTITY_ENERGY,
		shields: ENTITY_SHIELDS,
		aiTuning: {
			foresight: options.foresight,
			...(options.goalWidth == null ? {} : { goalWidth: options.goalWidth }),
			...(options.goalWeightRolloff == null
				? {}
				: { goalWeightRolloff: options.goalWeightRolloff }),
		},
		moves: [
			[entity.attackOne, []],
			[entity.attackTwo, []],
			[entity.utilityOne, []],
			[entity.utilityTwo, []],
		],
		blessings: [],
		inventory: [],
	};
}

function reorderEntitiesForCombat(
	entities: [EntityLoadout, EntityLoadout],
	shouldSwap: boolean,
): [EntityLoadout, EntityLoadout] {
	return shouldSwap
		? [entities[1], entities[0]]
		: [entities[0], entities[1]];
}

function buildCombatFixture(
	matchup: Matchup,
	combatIndex: number,
	options: SweepOptions,
): CombatState {
	const swapParty = combatIndex === 2 || combatIndex === 4;
	const swapEncounters = combatIndex === 3 || combatIndex === 4;
	const party = reorderEntitiesForCombat(matchup.party.entities, swapParty)
		.map((entity) => createEntityTemplate(entity, options));
	const encounters = reorderEntitiesForCombat(matchup.encounter.entities, swapEncounters)
		.map((entity) => createEntityTemplate(entity, options));

	const combat = buildCombatState(party, encounters);
	combat.turn = 1;
	combat.hasPriority = combatIndex % 2 === 0 ? 'party' : 'encounters';
	revealAllMoves(combat);
	return combat;
}

function revealAllMoves(
	combat: CombatState,
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

function teamAlive(
	team: Array<CombatEntity>,
): boolean {
	return team.some((entity) => !entity.isDead);
}

function getWinner(
	combat: CombatState,
): Winner | null {
	const partyAlive = teamAlive(combat.entities.party);
	const encountersAlive = teamAlive(combat.entities.encounters);
	if (partyAlive && encountersAlive) {
		return null;
	}
	if (partyAlive) {
		return 'party';
	}
	if (encountersAlive) {
		return 'encounters';
	}
	return 'draw';
}

function currentRoundOrder(
	combat: CombatState,
): Array<string> {
	const teams = combat.hasPriority === 'party'
		? [combat.entities.party, combat.entities.encounters]
		: [combat.entities.encounters, combat.entities.party];

	return teams
		.flatMap((team) => team)
		.filter((entity) => !entity.isDead)
		.map((entity) => entity.id);
}

function splitTickStatuses(
	statuses: ReturnType<typeof audit>['statuses'],
): {
	damage: Array<'burn' | 'decay'>;
	remaining: RemainingStatuses;
} {
	return {
		damage: statuses.filter(
			(status): status is 'burn' | 'decay' =>
				status === 'burn' || status === 'decay',
		),
		remaining: statuses.filter(
			(status): status is RemainingStatuses[number] =>
				status !== 'burn' &&
				status !== 'decay' &&
				status !== 'wound',
		),
	};
}

function findEntity(
	combat: CombatState,
	entityId: string,
): CombatEntity | null {
	return [
		...combat.entities.party,
		...combat.entities.encounters,
	].find((entity) => entity.id === entityId) ?? null;
}

function describeChoice(
	choice: TurnChoice,
): string {
	const targets = choice.targets.entities.map((entity) => entity.id).join(',');
	const moves = choice.targets.moves.map((move) => move.id).join(',');
	const targetSummary = [targets, moves].filter((part) => part.length > 0).join(' | ');
	return `${choice.move.id} -> ${targetSummary.length > 0 ? targetSummary : '-'}`;
}

async function planChoices(
	combat: CombatState,
	options: SweepOptions,
): Promise<PlannerBatch> {
	hydrateCombatGoals(combat);
	hydrateAiGoalListeners(combat);
	primeAiPredictionCache(combat);

	if (options.planner === 'workers') {
		const result = await calculateAllTurnChoicesInWorkersDetailed(combat);
		return {
			choicesByEntityId: result.choicesByEntityId,
			planningMs: result.summary.totalElapsedMs,
		};
	}

	const startedAt = Date.now();
	return {
		choicesByEntityId: calculateAllTurnChoices(combat),
		planningMs: Date.now() - startedAt,
	};
}

async function runCombatSimulation(
	matchup: Matchup,
	combatIndex: number,
	options: SweepOptions,
): Promise<CombatSimulationResult> {
	const combat = buildCombatFixture(matchup, combatIndex, options);
	const log: Array<string> = [
		`matchup=${matchup.id} combat=${combatIndex + 1} initial_priority=${combat.hasPriority}`,
		`party_variant=${matchup.party.label}`,
		`encounter_variant=${matchup.encounter.label}`,
	];
	let totalPlanningMs = 0;
	const startedAt = Date.now();

	for (let completedRounds = 0; completedRounds <= options.maxRounds; completedRounds += 1) {
		const winner = getWinner(combat);
		if (winner) {
			return {
				combatIndex,
				log,
				roundsCompleted: Math.max(0, combat.turn - 1),
				totalElapsedMs: Date.now() - startedAt,
				totalPlanningMs,
				winner,
			};
		}

		if (completedRounds === options.maxRounds) {
			return {
				combatIndex,
				log,
				roundsCompleted: options.maxRounds,
				totalElapsedMs: Date.now() - startedAt,
				totalPlanningMs,
				winner: 'draw',
			};
		}

		const batch = await planChoices(combat, options);
		totalPlanningMs += batch.planningMs;
		log.push(
			`round=${combat.turn} priority=${combat.hasPriority} planning_ms=${batch.planningMs}`,
		);

		for (const actorId of currentRoundOrder(combat)) {
			const actor = findEntity(combat, actorId);
			if (!actor || actor.isDead) {
				if (actor) {
					cleanupEntity(actor);
				}
				log.push(`round=${combat.turn} actor=${actorId} action=skip reason=missing_or_dead`);
				continue;
			}

			const audits = audit(actor, combat);
			const statuses = splitTickStatuses(audits.statuses);
			if (statuses.damage.length > 0) {
				tickStatuses(combat, actor, statuses.damage);
			}

			if (actor.isDead) {
				log.push(`round=${combat.turn} actor=${actor.id} action=skip reason=died_before_acting`);
				cleanupEntity(actor);
				continue;
			}

			const choices = batch.choicesByEntityId.get(actor.id) ?? [];
			const chosen = choices[0] ?? null;
			if (!chosen) {
				log.push(`round=${combat.turn} actor=${actor.id} action=skip reason=no_choice`);
			} else if (turnChoiceDisqualified(actor, chosen)) {
				log.push(
					`round=${combat.turn} actor=${actor.id} action=skip reason=disqualified planned="${describeChoice(chosen)}"`,
				);
			} else {
				executeTurnChoice(combat, actor, chosen);
				log.push(
					`round=${combat.turn} actor=${actor.id} action="${describeChoice(chosen)}"`,
				);
			}

			if (statuses.remaining.length > 0) {
				tickStatuses(combat, actor, statuses.remaining);
			}
			if (audits.attunements.length > 0) {
				tickAttunements(combat, actor, audits.attunements);
			}
			if (audits.ignoresStatuses.length > 0) {
				tickIgnoresStatuses(combat, actor, audits.ignoresStatuses);
			}
			if (audits.cooldowns.length > 0) {
				tickCooldowns(combat, actor, audits.cooldowns);
			}
			if (audits.listeners.length > 0) {
				tickListenerCharges(combat, actor, audits.listeners);
			}

			cleanupEntity(actor);
		}

		combat.hasPriority = combat.hasPriority === 'party'
			? 'encounters'
			: 'party';
		combat.turn += 1;
	}

	return {
		combatIndex,
		log,
		roundsCompleted: options.maxRounds,
		totalElapsedMs: Date.now() - startedAt,
		totalPlanningMs,
		winner: 'draw',
	};
}

async function runMatchup(
	matchup: Matchup,
	options: SweepOptions,
): Promise<MatchupResult> {
	const combats: Array<CombatSimulationResult> = [];
	let partyWins = 0;
	let encountersWins = 0;
	let draws = 0;
	let totalRounds = 0;
	let totalPlanningMs = 0;
	let totalElapsedMs = 0;

	for (let combatIndex = 0; combatIndex < options.combatsPerMatchup; combatIndex += 1) {
		const result = await runCombatSimulation(matchup, combatIndex, options);
		combats.push(result);
		totalRounds += result.roundsCompleted;
		totalPlanningMs += result.totalPlanningMs;
		totalElapsedMs += result.totalElapsedMs;

		if (result.winner === 'party') {
			partyWins += 1;
		} else if (result.winner === 'encounters') {
			encountersWins += 1;
		} else {
			draws += 1;
		}
	}

	return {
		averageElapsedMs: totalElapsedMs / combats.length,
		averagePlanningMs: totalPlanningMs / combats.length,
		averageRounds: totalRounds / combats.length,
		combats,
		draws,
		encounterVariant: matchup.encounter,
		encountersWins,
		matchup,
		partyVariant: matchup.party,
		partyWins,
	};
}

function moveBucket(
	moveId: string,
): BucketName {
	if (BasicAttackMoves.some((move) => move.id === moveId)) {
		return 'attack';
	}
	if (UtilityMoves11To17.some((move) => move.id === moveId)) {
		return 'utility11';
	}
	return 'utility21';
}

function moveName(
	moveId: string,
): string {
	return MoveTemplatesById.get(moveId)?.name ?? moveId;
}

function ensureMoveSummaryStat(
	stats: Map<string, MoveSummaryStat>,
	moveId: string,
): MoveSummaryStat {
	const existing = stats.get(moveId);
	if (existing) {
		return existing;
	}
	const created: MoveSummaryStat = {
		draws: 0,
		losses: 0,
		moveId,
		samples: 0,
		wins: 0,
	};
	stats.set(moveId, created);
	return created;
}

function ensureMoveMatrixStat(
	stats: Map<string, MoveMatrixStat>,
	moveId: string,
	opponentMoveId: string,
): MoveMatrixStat {
	const key = `${moveId}::${opponentMoveId}`;
	const existing = stats.get(key);
	if (existing) {
		return existing;
	}
	const created: MoveMatrixStat = {
		draws: 0,
		losses: 0,
		moveId,
		opponentMoveId,
		samples: 0,
		wins: 0,
	};
	stats.set(key, created);
	return created;
}

function recordTeamOutcome(
	stats: Map<string, MoveSummaryStat>,
	moveIds: Array<string>,
	winner: Winner,
	team: CombatTeam,
): void {
	for (const moveId of moveIds) {
		const stat = ensureMoveSummaryStat(stats, moveId);
		stat.samples += 1;
		if (winner === 'draw') {
			stat.draws += 1;
		} else if (winner === team) {
			stat.wins += 1;
		} else {
			stat.losses += 1;
		}
	}
}

function recordMatrixOutcome(
	stats: Map<string, MoveMatrixStat>,
	partyMoveIds: Array<string>,
	encounterMoveIds: Array<string>,
	winner: Winner,
): void {
	for (const partyMoveId of partyMoveIds) {
		for (const encounterMoveId of encounterMoveIds) {
			const partyStat = ensureMoveMatrixStat(stats, partyMoveId, encounterMoveId);
			partyStat.samples += 1;
			if (winner === 'draw') {
				partyStat.draws += 1;
			} else if (winner === 'party') {
				partyStat.wins += 1;
			} else {
				partyStat.losses += 1;
			}

			const encounterStat = ensureMoveMatrixStat(stats, encounterMoveId, partyMoveId);
			encounterStat.samples += 1;
			if (winner === 'draw') {
				encounterStat.draws += 1;
			} else if (winner === 'encounters') {
				encounterStat.wins += 1;
			} else {
				encounterStat.losses += 1;
			}
		}
	}
}

function updateProgressStats(
	progress: ProgressState,
	result: MatchupResult,
): void {
	const partyMoveIds = teamMoveIds(result.partyVariant);
	const encounterMoveIds = teamMoveIds(result.encounterVariant);

	for (const combat of result.combats) {
		recordTeamOutcome(progress.moveSummaryStats, partyMoveIds, combat.winner, 'party');
		recordTeamOutcome(progress.moveSummaryStats, encounterMoveIds, combat.winner, 'encounters');
		recordMatrixOutcome(progress.moveMatrixStats, partyMoveIds, encounterMoveIds, combat.winner);
	}
}

function ratio(
	numerator: number,
	denominator: number,
): string {
	if (denominator <= 0) {
		return '0.0000';
	}
	return (numerator / denominator).toFixed(4);
}

function csvEscape(
	value: string | number,
): string {
	const text = String(value);
	if (!text.includes(',') && !text.includes('"') && !text.includes('\n')) {
		return text;
	}
	return `"${text.replaceAll('"', '""')}"`;
}

async function initializeOutputFiles(
	options: SweepOptions,
	totalMatchups: number,
): Promise<void> {
	await mkdir(options.outputDir, { recursive: true });

	await writeFile(
		resolve(options.outputDir, MATCHUPS_CSV),
		[
			'matchup_index,matchup_id,party_variant,encounter_variant,party_loadout,encounter_loadout,combats,party_wins,encounter_wins,draws,party_win_rate,encounter_win_rate,draw_rate,avg_rounds,avg_planning_ms,avg_elapsed_ms',
		].join('\n') + '\n',
		'utf8',
	);

	await writeFile(
		resolve(options.outputDir, MOVE_SUMMARY_CSV),
		[
			'move_id,move_name,bucket,samples,wins,losses,draws,win_rate,loss_rate,draw_rate',
		].join('\n') + '\n',
		'utf8',
	);

	await writeFile(
		resolve(options.outputDir, MOVE_MATRIX_CSV),
		[
			'move_id,move_name,opponent_move_id,opponent_move_name,samples,wins,losses,draws,win_rate,loss_rate,draw_rate',
		].join('\n') + '\n',
		'utf8',
	);

	await writeFile(
		resolve(options.outputDir, COMBAT_LOG),
		[
			`ai_move_balance_sweep total_matchups=${totalMatchups}`,
			`planner=${options.planner} concurrency=${options.concurrency} combats=${options.combatsPerMatchup} max_rounds=${options.maxRounds} foresight=${options.foresight}`,
			'',
		].join('\n'),
		'utf8',
	);
}

async function appendMatchupRow(
	options: SweepOptions,
	result: MatchupResult,
): Promise<void> {
	const row = [
		result.matchup.index,
		result.matchup.id,
		result.partyVariant.label,
		result.encounterVariant.label,
		teamLoadoutLabel(result.partyVariant),
		teamLoadoutLabel(result.encounterVariant),
		result.combats.length,
		result.partyWins,
		result.encountersWins,
		result.draws,
		ratio(result.partyWins, result.combats.length),
		ratio(result.encountersWins, result.combats.length),
		ratio(result.draws, result.combats.length),
		result.averageRounds.toFixed(2),
		result.averagePlanningMs.toFixed(2),
		result.averageElapsedMs.toFixed(2),
	].map(csvEscape).join(',');

	await appendFile(
		resolve(options.outputDir, MATCHUPS_CSV),
		`${row}\n`,
		'utf8',
	);
}

async function appendCombatLogs(
	options: SweepOptions,
	result: MatchupResult,
): Promise<void> {
	const sections: Array<string> = [
		`=== matchup ${result.matchup.index} / ${result.matchup.id} ===`,
		`party_variant=${result.partyVariant.label}`,
		`encounter_variant=${result.encounterVariant.label}`,
		`party_loadout=${teamLoadoutLabel(result.partyVariant)}`,
		`encounter_loadout=${teamLoadoutLabel(result.encounterVariant)}`,
		`party_wins=${result.partyWins} encounter_wins=${result.encountersWins} draws=${result.draws}`,
	];

	for (const combat of result.combats) {
		sections.push(
			[
				`--- combat ${combat.combatIndex + 1} ---`,
				`winner=${combat.winner}`,
				`rounds=${combat.roundsCompleted}`,
				`planning_ms=${combat.totalPlanningMs}`,
				`elapsed_ms=${combat.totalElapsedMs}`,
			].join(' '),
		);
		sections.push(...combat.log);
	}

	sections.push('');

	await appendFile(
		resolve(options.outputDir, COMBAT_LOG),
		`${sections.join('\n')}\n`,
		'utf8',
	);
}

async function writeMoveSummaryCsv(
	options: SweepOptions,
	stats: Map<string, MoveSummaryStat>,
): Promise<void> {
	const rows = [...stats.values()]
		.sort((left, right) =>
			left.moveId.localeCompare(right.moveId),
		)
		.map((stat) => [
			stat.moveId,
			moveName(stat.moveId),
			moveBucket(stat.moveId),
			stat.samples,
			stat.wins,
			stat.losses,
			stat.draws,
			ratio(stat.wins, stat.samples),
			ratio(stat.losses, stat.samples),
			ratio(stat.draws, stat.samples),
		].map(csvEscape).join(','));

	await writeFile(
		resolve(options.outputDir, MOVE_SUMMARY_CSV),
		[
			'move_id,move_name,bucket,samples,wins,losses,draws,win_rate,loss_rate,draw_rate',
			...rows,
		].join('\n') + '\n',
		'utf8',
	);
}

async function writeMoveMatrixCsv(
	options: SweepOptions,
	stats: Map<string, MoveMatrixStat>,
): Promise<void> {
	const rows = [...stats.values()]
		.sort((left, right) =>
			left.moveId.localeCompare(right.moveId) ||
			left.opponentMoveId.localeCompare(right.opponentMoveId),
		)
		.map((stat) => [
			stat.moveId,
			moveName(stat.moveId),
			stat.opponentMoveId,
			moveName(stat.opponentMoveId),
			stat.samples,
			stat.wins,
			stat.losses,
			stat.draws,
			ratio(stat.wins, stat.samples),
			ratio(stat.losses, stat.samples),
			ratio(stat.draws, stat.samples),
		].map(csvEscape).join(','));

	await writeFile(
		resolve(options.outputDir, MOVE_MATRIX_CSV),
		[
			'move_id,move_name,opponent_move_id,opponent_move_name,samples,wins,losses,draws,win_rate,loss_rate,draw_rate',
			...rows,
		].join('\n') + '\n',
		'utf8',
	);
}

function formatDuration(
	ms: number,
): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return [
		String(hours).padStart(2, '0'),
		String(minutes).padStart(2, '0'),
		String(seconds).padStart(2, '0'),
	].join(':');
}

function renderProgressLine(
	progress: ProgressState,
	result: MatchupResult,
): string {
	const elapsedMs = Date.now() - progress.startedAtMs;
	const remainingMatchups = progress.totalMatchups - progress.completedMatchups;
	const avgPerMatchupMs = elapsedMs / Math.max(1, progress.completedMatchups);
	const etaMs = remainingMatchups * avgPerMatchupMs;
	const completion = (progress.completedMatchups / progress.totalMatchups) * 100;

	return [
		`[${progress.completedMatchups}/${progress.totalMatchups}]`,
		`${completion.toFixed(2)}%`,
		`party=${result.partyVariant.label}`,
		`encounters=${result.encounterVariant.label}`,
		`record=${result.partyWins}-${result.encountersWins}-${result.draws}`,
		`avg_rounds=${result.averageRounds.toFixed(2)}`,
		`elapsed=${formatDuration(elapsedMs)}`,
		`eta=${formatDuration(etaMs)}`,
	].join(' ');
}

function renderTopMoves(
	stats: Map<string, MoveSummaryStat>,
	limit = 10,
): Array<string> {
	return [...stats.values()]
		.sort((left, right) =>
			(right.wins / Math.max(1, right.samples)) -
				(left.wins / Math.max(1, left.samples)) ||
			right.samples - left.samples ||
			left.moveId.localeCompare(right.moveId),
		)
		.slice(0, limit)
		.map((stat, index) =>
			[
				`${index + 1}.`,
				stat.moveId,
				`(${moveName(stat.moveId)})`,
				`bucket=${moveBucket(stat.moveId)}`,
				`samples=${stat.samples}`,
				`wins=${stat.wins}`,
				`losses=${stat.losses}`,
				`draws=${stat.draws}`,
				`win_rate=${ratio(stat.wins, stat.samples)}`,
			].join(' '),
		);
}

function defaultConcurrency(): number {
	return Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
}

function parseInteger(
	value: string,
): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) ? parsed : null;
}

function parseFloatNumber(
	value: string,
): number | null {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseOptions(
	argv: Array<string>,
): SweepOptions {
	const options: SweepOptions = {
		combatsPerMatchup: DEFAULT_COMBATS_PER_MATCHUP,
		concurrency: defaultConcurrency(),
		foresight: DEFAULT_FORESIGHT,
		goalWeightRolloff: null,
		goalWidth: null,
		matchupLimit: null,
		maxRounds: DEFAULT_MAX_ROUNDS,
		outputDir: DEFAULT_OUTPUT_DIR,
		planner: DEFAULT_PLANNER,
		verbose: false,
	};

	for (const arg of argv) {
		if (arg.startsWith('--combats=')) {
			const parsed = parseInteger(arg.slice('--combats='.length));
			if (parsed && parsed > 0) {
				options.combatsPerMatchup = parsed;
			}
			continue;
		}

		if (arg.startsWith('--concurrency=')) {
			const parsed = parseInteger(arg.slice('--concurrency='.length));
			if (parsed && parsed > 0) {
				options.concurrency = parsed;
			}
			continue;
		}

		if (arg.startsWith('--foresight=')) {
			const parsed = parseInteger(arg.slice('--foresight='.length));
			if (parsed != null && parsed >= 0) {
				options.foresight = parsed;
			}
			continue;
		}

		if (arg.startsWith('--goal-width=')) {
			const parsed = parseInteger(arg.slice('--goal-width='.length));
			if (parsed != null && parsed > 0) {
				options.goalWidth = parsed;
			}
			continue;
		}

		if (arg.startsWith('--goal-weight-rolloff=')) {
			const parsed = parseFloatNumber(arg.slice('--goal-weight-rolloff='.length));
			if (parsed != null && parsed >= 0 && parsed <= 1) {
				options.goalWeightRolloff = parsed;
			}
			continue;
		}

		if (arg.startsWith('--limit=')) {
			const parsed = parseInteger(arg.slice('--limit='.length));
			if (parsed != null && parsed >= 0) {
				options.matchupLimit = parsed;
			}
			continue;
		}

		if (arg.startsWith('--max-rounds=')) {
			const parsed = parseInteger(arg.slice('--max-rounds='.length));
			if (parsed && parsed > 0) {
				options.maxRounds = parsed;
			}
			continue;
		}

		if (arg.startsWith('--output-dir=')) {
			options.outputDir = resolve(arg.slice('--output-dir='.length));
			continue;
		}

		if (arg.startsWith('--planner=')) {
			const planner = arg.slice('--planner='.length);
			if (planner === 'serial' || planner === 'workers') {
				options.planner = planner;
			}
			continue;
		}

		if (arg === '--verbose') {
			options.verbose = true;
		}
	}

	return options;
}

function validateMoveCatalog(): void {
	if (BasicAttackMoves.length !== 7) {
		throw new Error(`Expected 7 attack moves, received ${BasicAttackMoves.length}.`);
	}
	if (UtilityMoves11To17.length !== 7) {
		throw new Error(`Expected 7 utility moves in 11-17, received ${UtilityMoves11To17.length}.`);
	}
	if (UtilityMoves21To27.length !== 7) {
		throw new Error(`Expected 7 utility moves in 21-27, received ${UtilityMoves21To27.length}.`);
	}
}

async function recordMatchupResult(
	options: SweepOptions,
	progress: ProgressState,
	result: MatchupResult,
): Promise<void> {
	progress.completedMatchups += 1;
	updateProgressStats(progress, result);
	await appendMatchupRow(options, result);
	await appendCombatLogs(options, result);
	await Promise.all([
		writeMoveSummaryCsv(options, progress.moveSummaryStats),
		writeMoveMatrixCsv(options, progress.moveMatrixStats),
	]);
	process.stdout.write(`${renderProgressLine(progress, result)}\n`);

	if (options.verbose) {
		for (const combat of result.combats) {
			process.stdout.write(
				[
					`  combat=${combat.combatIndex + 1}`,
					`winner=${combat.winner}`,
					`rounds=${combat.roundsCompleted}`,
					`planning_ms=${combat.totalPlanningMs}`,
					`elapsed_ms=${combat.totalElapsedMs}`,
				].join(' ') + '\n',
			);
		}
	}
}

async function runSweep(
	options: SweepOptions,
): Promise<void> {
	validateMoveCatalog();

	const partyVariants = createTeamVariants(PartyBaseTeam);
	const encounterVariants = createTeamVariants(EncounterBaseTeam);
	const matchups = createMatchups(
		partyVariants,
		encounterVariants,
		options.matchupLimit,
	);

	await initializeOutputFiles(options, matchups.length);

	const progress: ProgressState = {
		completedMatchups: 0,
		moveMatrixStats: new Map(),
		moveSummaryStats: new Map(),
		startedAtMs: Date.now(),
		totalMatchups: matchups.length,
	};

	process.stdout.write(
		[
			'Running AI move balance sweep.',
			`party_variants=${partyVariants.length}`,
			`encounter_variants=${encounterVariants.length}`,
			`matchups=${matchups.length}`,
			`combats=${options.combatsPerMatchup}`,
			`planner=${options.planner}`,
			`concurrency=${options.concurrency}`,
			`max_rounds=${options.maxRounds}`,
			`foresight=${options.foresight}`,
			`output_dir=${options.outputDir}`,
		].join(' ') + '\n',
	);

	let nextMatchupIndex = 0;
	let recordQueue = Promise.resolve();
	const workers = Array.from({ length: options.concurrency }, async () => {
		while (true) {
			const matchup = matchups[nextMatchupIndex];
			nextMatchupIndex += 1;
			if (!matchup) {
				return;
			}

			const result = await runMatchup(matchup, options);
			recordQueue = recordQueue.then(() =>
				recordMatchupResult(options, progress, result),
			);
			await recordQueue;
		}
	});

	await Promise.all(workers);

	const elapsedMs = Date.now() - progress.startedAtMs;
	process.stdout.write(
		[
			'Sweep complete.',
			`elapsed=${formatDuration(elapsedMs)}`,
			`matchups=${progress.completedMatchups}`,
			`matchups_csv=${resolve(options.outputDir, MATCHUPS_CSV)}`,
			`move_summary_csv=${resolve(options.outputDir, MOVE_SUMMARY_CSV)}`,
			`move_matrix_csv=${resolve(options.outputDir, MOVE_MATRIX_CSV)}`,
			`combat_log=${resolve(options.outputDir, COMBAT_LOG)}`,
		].join('\n') + '\n',
	);

	process.stdout.write('Top moves by win rate:\n');
	for (const line of renderTopMoves(progress.moveSummaryStats)) {
		process.stdout.write(`${line}\n`);
	}
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	await runSweep(options);
}

void main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
	process.exitCode = 1;
});
