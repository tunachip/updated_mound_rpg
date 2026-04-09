// tests/ai-planner-benchmark.ts

import { createHash } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
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
	CombatMove,
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
	tickStatuses,
	turnChoiceDisqualified,
} from '../src/combat/turn/index.ts';
import { BasicAttackMoves } from '../src/data/templates/move/index.ts';
import type { EntityTemplate } from '../src/data/templates/index.ts';
import { DamageElements, Statuses } from '../src/shared/index.ts';
import type { Status } from '../src/shared/index.ts';

const OUTPUT_DIR = resolve('tests/output');
const OUTPUT_FILES = {
	serial: resolve(OUTPUT_DIR, 'ai-benchmark-serial.log'),
	worker: resolve(OUTPUT_DIR, 'ai-benchmark-worker.log'),
} as const;

const DEFAULT_MAX_ROUNDS = 50;
const DEFAULT_LEVELS = [1, 2, 3, 4, 5] as const;

type PlannerName = keyof typeof OUTPUT_FILES;
type RemainingStatuses = Array<Exclude<Status, 'burn' | 'decay' | 'wound'>>;
type ComparableSimulationResult = Omit<SimulationResult, 'log'>;

interface BenchmarkOptions {
	levels: Array<number>;
	maxRounds: number;
	planners: Array<PlannerName>;
	verbose: boolean;
}

interface PlannerBatch {
	choicesByEntityId: Map<string, Array<TurnChoice>>;
	planningMs: number;
	detail: string;
}

interface Planner {
	name: PlannerName;
	plan(combat: CombatState): Promise<PlannerBatch>;
}

interface ActionRecord {
	round: number;
	actorId: string;
	action: string;
}

interface SimulationResult {
	method: PlannerName;
	level: number;
	winner: string;
	roundsCompleted: number;
	totalPlanningMs: number;
	totalElapsedMs: number;
	actionTrace: Array<ActionRecord>;
	finalStateHash: string;
	log: Array<string>;
}

function stableHash(
	value: string,
): string {
	return createHash('sha256').update(value).digest('hex');
}

function entityTemplate(
	id: string,
	name: string,
	level: number,
	moveIndexes: Array<number>,
): EntityTemplate {
	return {
		id,
		name,
		level,
		xp: 0,
		entityType: 'forecasted',
		hp: 18,
		maxHp: 18,
		energy: 3,
		maxEnergy: 3,
		shields: 0,
		moves: moveIndexes.map((index) => [BasicAttackMoves[index], []]),
		blessings: [],
		inventory: [],
	};
}

function buildFixture(
	level: number,
): CombatState {
	const party: Array<EntityTemplate> = [
		entityTemplate('party_1', 'Azure Knight', level, [0, 2]),
		entityTemplate('party_2', 'Granite Sage', level, [1, 5]),
		entityTemplate('party_3', 'Bloom Warden', level, [3, 4]),
		entityTemplate('party_4', 'Storm Scout', level, [6, 0]),
	];

	const encounters: Array<EntityTemplate> = [
		entityTemplate('enc_1', 'Rift Hound', level, [5, 6]),
		entityTemplate('enc_2', 'Ember Imp', level, [2, 1]),
		entityTemplate('enc_3', 'Mire Fang', level, [3, 4]),
		entityTemplate('enc_4', 'Tide Monk', level, [0, 1]),
	];

	const combat = buildCombatState(party, encounters);
	combat.turn = 1;
	combat.hasPriority = 'party';
	return combat;
}

function teamAlive(
	team: Array<CombatEntity>,
): boolean {
	return team.some((entity) => entity.isDead === false);
}

function getWinner(
	combat: CombatState,
): string | null {
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
		.filter((entity) => entity.isDead === false)
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

function describeTargets(
	choice: TurnChoice,
): string {
	const targets = choice.targets.entities.map((entity) => entity.id);
	return targets.length > 0 ? targets.join(',') : '-';
}

function describeChoice(
	choice: TurnChoice,
): string {
	return `${choice.move.id} -> ${describeTargets(choice)}`;
}

function serializeMove(
	move: CombatMove,
): string {
	return [
		move.id,
		Number(move.isHidden),
		move.cooldownTurns,
		Number(move.isBound),
		move.baseDamage,
		move.baseIterations,
		move.element,
	].join(':');
}

function serializeEntity(
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
	const moves = entity.moves.map(serializeMove).join(',');

	return [
		entity.id,
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
		entity.maxDamageTaken,
		entity.lastDamageTaken,
		entity.totalDamageTaken,
		attunements,
		statuses,
		moves,
	].join('|');
}

function finalStateHash(
	combat: CombatState,
): string {
	const serialized = [
		combat.turn,
		combat.hasPriority,
		combat.entities.party.map(serializeEntity).join('||'),
		combat.entities.encounters.map(serializeEntity).join('||'),
	].join('###');
	return stableHash(serialized);
}

async function serialPlanner(
	combat: CombatState,
): Promise<PlannerBatch> {
	const startedAt = Date.now();
	const choicesByEntityId = calculateAllTurnChoices(combat);
	const planningMs = Date.now() - startedAt;

	return {
		choicesByEntityId,
		planningMs,
		detail: `serial_ms=${planningMs}`,
	};
}

async function workerPlanner(
	combat: CombatState,
): Promise<PlannerBatch> {
	const result = await calculateAllTurnChoicesInWorkersDetailed(combat);
	return {
		choicesByEntityId: result.choicesByEntityId,
		planningMs: result.summary.totalElapsedMs,
		detail: [
			`worker_total_ms=${result.summary.totalElapsedMs}`,
			`worker_threads=${result.summary.workerCount}`,
			`worker_elapsed_ms=${result.summary.workerElapsedMs.join(',')}`,
		].join(' '),
	};
}

const PLANNERS: Array<Planner> = [
	{ name: 'serial', plan: serialPlanner },
	{ name: 'worker', plan: workerPlanner },
];

async function runSimulation(
	planner: Planner,
	level: number,
	options: BenchmarkOptions,
): Promise<SimulationResult> {
	const combat = buildFixture(level);
	const log: Array<string> = [];
	const actionTrace: Array<ActionRecord> = [];
	let totalPlanningMs = 0;
	const startedAt = Date.now();

	for (let round = 1; round <= options.maxRounds; round += 1) {
		const winner = getWinner(combat);
		if (winner) {
			const completedRounds = combat.turn - 1;
			return {
				method: planner.name,
				level,
				winner,
				roundsCompleted: completedRounds,
				totalPlanningMs,
				totalElapsedMs: Date.now() - startedAt,
				actionTrace,
				finalStateHash: finalStateHash(combat),
				log,
			};
		}

		hydrateCombatGoals(combat);
		hydrateAiGoalListeners(combat);
		primeAiPredictionCache(combat);

		const batch = await planner.plan(combat);
		totalPlanningMs += batch.planningMs;
		log.push(
			`level=${level} round=${combat.turn} priority=${combat.hasPriority} ` +
			`plan_ms=${batch.planningMs} ${batch.detail}`,
		);

		for (const actorId of currentRoundOrder(combat)) {
			const actor = findEntity(combat, actorId);
			if (!actor || actor.isDead) {
				if (actor) {
					cleanupEntity(actor);
				}
				log.push(
					`level=${level} round=${combat.turn} actor=${actorId} action=skip reason=missing_or_dead`,
				);
				actionTrace.push({
					round: combat.turn,
					actorId,
					action: 'skip:missing_or_dead',
				});
				continue;
			}

			const audits = audit(actor);
			const statuses = splitTickStatuses(audits.statuses);
			if (statuses.damage.length > 0) {
				tickStatuses(combat, actor, statuses.damage);
			}

			if (actor.isDead) {
				log.push(
					`level=${level} round=${combat.turn} actor=${actor.id} action=skip reason=died_before_acting`,
				);
				actionTrace.push({
					round: combat.turn,
					actorId: actor.id,
					action: 'skip:died_before_acting',
				});
				cleanupEntity(actor);
				continue;
			}

			const choices = batch.choicesByEntityId.get(actor.id) ?? [];
			const chosen = choices[0] ?? null;

			if (!chosen) {
				log.push(
					`level=${level} round=${combat.turn} actor=${actor.id} action=skip reason=no_choice`,
				);
				actionTrace.push({
					round: combat.turn,
					actorId: actor.id,
					action: 'skip:no_choice',
				});
			} else if (turnChoiceDisqualified(actor, chosen)) {
				log.push(
					`level=${level} round=${combat.turn} actor=${actor.id} action=skip ` +
					`reason=disqualified planned="${describeChoice(chosen)}"`,
				);
				actionTrace.push({
					round: combat.turn,
					actorId: actor.id,
					action: `skip:disqualified:${describeChoice(chosen)}`,
				});
			} else {
				executeTurnChoice(combat, actor, chosen);
				log.push(
					`level=${level} round=${combat.turn} actor=${actor.id} ` +
					`action="${describeChoice(chosen)}" plan_ms=${batch.planningMs}`,
				);
				actionTrace.push({
					round: combat.turn,
					actorId: actor.id,
					action: describeChoice(chosen),
				});
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

			cleanupEntity(actor);
		}

		combat.hasPriority =
			combat.hasPriority === 'party'
				? 'encounters'
				: 'party';
		combat.turn += 1;
	}

	return {
		method: planner.name,
		level,
		winner: 'draw',
		roundsCompleted: options.maxRounds,
		totalPlanningMs,
		totalElapsedMs: Date.now() - startedAt,
		actionTrace,
		finalStateHash: finalStateHash(combat),
		log,
	};
}

function renderSimulationResult(
	result: SimulationResult,
): string {
	const header = [
		`method=${result.method}`,
		`level=${result.level}`,
		`winner=${result.winner}`,
		`rounds_completed=${result.roundsCompleted}`,
		`total_planning_ms=${result.totalPlanningMs}`,
		`total_elapsed_ms=${result.totalElapsedMs}`,
		`final_state_hash=${result.finalStateHash}`,
	].join(' ');

	return [
		header,
		...result.log,
		'',
	].join('\n');
}

function outcomeSignature(
	result: Pick<
		ComparableSimulationResult,
		'winner' | 'roundsCompleted' | 'actionTrace' | 'finalStateHash'
	>,
): string {
	return stableHash(JSON.stringify({
		winner: result.winner,
		roundsCompleted: result.roundsCompleted,
		actionTrace: result.actionTrace,
		finalStateHash: result.finalStateHash,
	}));
}

async function resetOutputFiles(
	planners: Array<PlannerName>,
	options: BenchmarkOptions,
): Promise<void> {
	await mkdir(OUTPUT_DIR, { recursive: true });
	const header = [
		`benchmark levels=${options.levels.join(',')} max_rounds=${options.maxRounds} verbose=${options.verbose}`,
		'',
	].join('\n');

	await Promise.all(
		planners.map((planner) =>
			writeFile(OUTPUT_FILES[planner], header, 'utf8'),
		),
	);
}

async function appendSimulationResult(
	result: SimulationResult,
): Promise<void> {
	await appendFile(
		OUTPUT_FILES[result.method],
		`${renderSimulationResult(result)}\n`,
		'utf8',
	);
}

function stripSimulationLog(
	result: SimulationResult,
): ComparableSimulationResult {
	const { log: _log, ...rest } = result;
	return rest;
}

function parseLevels(
	raw: string,
): Array<number> {
	return raw
		.split(',')
		.map((part) => Number(part.trim()))
		.filter((value) => Number.isInteger(value) && value > 0);
}

function parsePlanners(
	raw: string,
): Array<PlannerName> {
	if (raw === 'both') {
		return ['serial', 'worker'];
	}

	return raw
		.split(',')
		.map((part) => part.trim())
		.filter((part): part is PlannerName =>
			part === 'serial' || part === 'worker',
		);
}

function parseCliArgs(
	argv: Array<string>,
): BenchmarkOptions {
	let levels: Array<number> = [...DEFAULT_LEVELS];
	let maxRounds = DEFAULT_MAX_ROUNDS;
	let planners: Array<PlannerName> = ['serial', 'worker'];
	let verbose = false;

	for (const arg of argv) {
		if (arg.startsWith('--levels=')) {
			const parsed = parseLevels(arg.slice('--levels='.length));
			if (parsed.length > 0) {
				levels = parsed;
			}
			continue;
		}

		if (arg.startsWith('--max-rounds=')) {
			const parsed = Number(arg.slice('--max-rounds='.length));
			if (Number.isInteger(parsed) && parsed > 0) {
				maxRounds = parsed;
			}
			continue;
		}

		if (arg.startsWith('--planner=')) {
			const parsed = parsePlanners(arg.slice('--planner='.length));
			if (parsed.length > 0) {
				planners = parsed;
			}
			continue;
		}

		if (arg === '--verbose') {
			verbose = true;
		}
	}

	return {
		levels,
		maxRounds,
		planners,
		verbose,
	};
}

async function main(): Promise<void> {
	const options = parseCliArgs(process.argv.slice(2));
	const enabledPlanners = PLANNERS.filter((planner) =>
		options.planners.includes(planner.name),
	);

	const resultsByMethod = new Map<PlannerName, Array<ComparableSimulationResult>>();
	for (const planner of enabledPlanners) {
		resultsByMethod.set(planner.name, []);
	}

	await resetOutputFiles(
		enabledPlanners.map((planner) => planner.name),
		options,
	);

	process.stdout.write(
		[
			`Running AI benchmark.`,
			`levels=${options.levels.join(',')}`,
			`max_rounds=${options.maxRounds}`,
			`planners=${enabledPlanners.map((planner) => planner.name).join(',')}`,
		].join(' ') + '\n',
	);

	for (const level of options.levels) {
		for (const planner of enabledPlanners) {
			process.stdout.write(
				`starting method=${planner.name} level=${level}\n`,
			);
			const result = await runSimulation(planner, level, options);
			await appendSimulationResult(result);
			resultsByMethod.get(planner.name)?.push(stripSimulationLog(result));
			process.stdout.write(
				[
					`finished method=${planner.name}`,
					`level=${level}`,
					`winner=${result.winner}`,
					`rounds=${result.roundsCompleted}`,
					`planning_ms=${result.totalPlanningMs}`,
					`elapsed_ms=${result.totalElapsedMs}`,
				].join(' ') + '\n',
			);
		}
	}

	const serialResults = resultsByMethod.get('serial') ?? [];
	const workerResults = resultsByMethod.get('worker') ?? [];
	const comparisonLines: Array<string> = [];
	let allMatched = true;

	for (const level of options.levels) {
		const serial = serialResults.find((result) => result.level === level);
		const worker = workerResults.find((result) => result.level === level);
		if (!serial || !worker) {
			if (enabledPlanners.length < 2) {
				continue;
			}
			allMatched = false;
			comparisonLines.push(`level=${level} missing_result=true`);
			continue;
		}

		const matched = outcomeSignature(serial) === outcomeSignature(worker);
		allMatched = allMatched && matched;
		comparisonLines.push(
			[
				`level=${level}`,
				`matched=${matched}`,
				`serial_winner=${serial.winner}`,
				`worker_winner=${worker.winner}`,
				`serial_rounds=${serial.roundsCompleted}`,
				`worker_rounds=${worker.roundsCompleted}`,
				`serial_planning_ms=${serial.totalPlanningMs}`,
				`worker_planning_ms=${worker.totalPlanningMs}`,
				`serial_elapsed_ms=${serial.totalElapsedMs}`,
				`worker_elapsed_ms=${worker.totalElapsedMs}`,
			].join(' '),
		);
	}

	const summary = [
		`Benchmark complete.`,
		...(enabledPlanners.some((planner) => planner.name === 'serial')
			? [`serial_log=${OUTPUT_FILES.serial}`]
			: []),
		...(enabledPlanners.some((planner) => planner.name === 'worker')
			? [`worker_log=${OUTPUT_FILES.worker}`]
			: []),
		`all_methods_matched=${allMatched}`,
		...comparisonLines,
	].join('\n');

	process.stdout.write(`${summary}\n`);
	process.exitCode = allMatched ? 0 : 1;
}

void main();
