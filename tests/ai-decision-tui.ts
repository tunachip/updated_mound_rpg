// tests/ai-decision-tui.ts

import {
	analyzeTurnChoices,
	hydrateAiGoalListeners,
	hydrateCombatGoals,
	type ChoiceAnalysis,
	type GoalContribution,
} from '../src/combat/ai/index.ts';
import { buildCombatState } from '../src/combat/constructor.ts';
import type { CombatEntity } from '../src/combat/models/index.ts';
import type { CombatState } from '../src/combat/types.ts';
import {
	audit,
	cleanupEntity,
	executeTurnChoice,
	tickAttunements,
	tickCooldowns,
	tickIgnoresStatuses,
	tickStatuses,
} from '../src/combat/turn/index.ts';
import { BasicAttackMoves } from '../src/data/templates/move/index.ts';
import type { EntityTemplate } from '../src/data/templates/index.ts';
import type { Status } from '../src/shared/index.ts';

const ANSI = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	cyan: '\x1b[36m',
	yellow: '\x1b[33m',
	green: '\x1b[32m',
	red: '\x1b[31m',
};

type RemainingStatuses = Array<Exclude<Status, 'burn' | 'decay' | 'wound'>>;

interface PendingTurn {
	actor: CombatEntity;
	analysis: Array<ChoiceAnalysis>;
	calculationMs: number;
	audits: ReturnType<typeof audit>;
	remainingStatuses: RemainingStatuses;
}

interface Simulation {
	loop: number;
	level: number;
	combat: CombatState;
	roundOrder: Array<string>;
	roundIndex: number;
	pending: PendingTurn | null;
	winner: string | null;
	log: Array<string>;
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

function formatTargets(
	analysis: ChoiceAnalysis,
): string {
	const entities = analysis.choice.targets.entities.map((entity) => entity.name);
	if (entities.length > 0) {
		return entities.join(', ');
	}
	return 'no target';
}

function formatContribution(
	contribution: GoalContribution,
): string {
	const sign = contribution.score > 0 ? '+' : '';
	return `${sign}${contribution.score.toFixed(2)} ${contribution.goal.name}`;
}

function formatStatuses(
	entity: CombatEntity,
): string {
	const statuses = Object.entries(entity.hasStatus)
		.filter(([, active]) => active === true)
		.map(([status]) => `${status}:${entity.statusTurns[status as Status]}`);
	return statuses.length > 0 ? statuses.join(' ') : '-';
}

function formatAttunements(
	entity: CombatEntity,
): string {
	const elements = Object.entries(entity.attunedTo)
		.filter(([, active]) => active === true)
		.map(([element]) => element.slice(0, 2).toUpperCase());
	return elements.length > 0 ? elements.join(' ') : '-';
}

function visibleMoveSummary(
	entity: CombatEntity,
): string {
	const revealed = entity.moves.filter((move) => move.isHidden === false).length;
	return `${revealed}/${entity.moves.length}`;
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

function pushLog(
	simulation: Simulation,
	line: string,
): void {
	simulation.log.unshift(line);
	simulation.log = simulation.log.slice(0, 12);
}

function beginRound(
	simulation: Simulation,
	advanceRound: boolean,
): void {
	if (advanceRound) {
		simulation.combat.hasPriority =
			simulation.combat.hasPriority === 'party'
				? 'encounters'
				: 'party';
		simulation.combat.turn += 1;
	}

	simulation.roundOrder = currentRoundOrder(simulation.combat);
	simulation.roundIndex = 0;
	pushLog(
		simulation,
		`Round ${simulation.combat.turn} begins. ${simulation.combat.hasPriority} has priority.`,
	);
}

function prepareNextPendingTurn(
	simulation: Simulation,
): void {
	while (true) {
		const winner = getWinner(simulation.combat);
		if (winner) {
			simulation.winner = winner;
			simulation.pending = null;
			pushLog(
				simulation,
				winner === 'draw'
					? `Loop ${simulation.loop} ended in a draw.`
					: `${winner} won loop ${simulation.loop}.`,
			);
			return;
		}

		if (simulation.roundOrder.length === 0 || simulation.roundIndex >= simulation.roundOrder.length) {
			beginRound(simulation, simulation.roundOrder.length > 0);
		}

		const actorId = simulation.roundOrder[simulation.roundIndex];
		simulation.roundIndex += 1;
		const actor = actorId ? findEntity(simulation.combat, actorId) : null;
		if (!actor || actor.isDead) {
			if (actor) {
				cleanupEntity(actor);
			}
			continue;
		}

		const audits = audit(actor);
		const statuses = splitTickStatuses(audits.statuses);
		if (statuses.damage.length > 0) {
			tickStatuses(simulation.combat, actor, statuses.damage);
		}

		if (actor.isDead) {
			pushLog(simulation, `${actor.name} died before acting.`);
			cleanupEntity(actor);
			continue;
		}

		hydrateCombatGoals(simulation.combat);
		hydrateAiGoalListeners(simulation.combat);
		const startedAt = Date.now();
		const analysis = analyzeTurnChoices(simulation.combat, actor);
		const calculationMs = Date.now() - startedAt;

		simulation.pending = {
			actor,
			analysis,
			calculationMs,
			audits,
			remainingStatuses: statuses.remaining,
		};

		pushLog(
			simulation,
			`${actor.name} analyzed ${analysis.length} choices in ${calculationMs}ms.`,
		);
		return;
	}
}

function createSimulation(
	level: number,
	loop: number,
): Simulation {
	const simulation: Simulation = {
		loop,
		level,
		combat: buildFixture(level),
		roundOrder: [],
		roundIndex: 0,
		pending: null,
		winner: null,
		log: [`Starting loop ${loop} with AI level ${level}.`],
	};

	beginRound(simulation, false);
	prepareNextPendingTurn(simulation);
	return simulation;
}

function advanceSimulation(
	simulation: Simulation,
): Simulation {
	if (simulation.winner) {
		return createSimulation(simulation.level + 1, simulation.loop + 1);
	}

	const pending = simulation.pending;
	if (!pending) {
		prepareNextPendingTurn(simulation);
		return simulation;
	}

	const chosen = pending.analysis[0];
	if (chosen) {
		executeTurnChoice(
			simulation.combat,
			pending.actor,
			chosen.choice,
		);
		pushLog(
			simulation,
			`${pending.actor.name} chose ${chosen.choice.move.name} -> ${formatTargets(chosen)} ` +
			`(score ${chosen.score.toFixed(2)}, ${pending.calculationMs}ms).`,
		);
	} else {
		pushLog(simulation, `${pending.actor.name} had no legal choices.`);
	}

	if (pending.remainingStatuses.length > 0) {
		tickStatuses(simulation.combat, pending.actor, pending.remainingStatuses);
	}
	if (pending.audits.attunements.length > 0) {
		tickAttunements(simulation.combat, pending.actor, pending.audits.attunements);
	}
	if (pending.audits.ignoresStatuses.length > 0) {
		tickIgnoresStatuses(simulation.combat, pending.actor, pending.audits.ignoresStatuses);
	}
	if (pending.audits.cooldowns.length > 0) {
		tickCooldowns(simulation.combat, pending.actor, pending.audits.cooldowns);
	}

	cleanupEntity(pending.actor);
	simulation.pending = null;
	prepareNextPendingTurn(simulation);
	return simulation;
}

function pad(
	value: string,
	width: number,
): string {
	return value.length >= width
		? value.slice(0, width)
		: `${value}${' '.repeat(width - value.length)}`;
}

function colorize(
	value: string,
	color: string | null,
): string {
	return color ? `${color}${value}${ANSI.reset}` : value;
}

function formatValue(
	value: unknown,
	seen: WeakSet<object> = new WeakSet(),
): string {
	if (value == null) {
		return String(value);
	}
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}
	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}
	if (typeof value !== 'object') {
		return String(value);
	}
	if (Array.isArray(value)) {
		const rendered = value
			.slice(0, 4)
			.map((entry) => formatValue(entry, seen));
		const suffix = value.length > 4 ? ', ...' : '';
		return `[${rendered.join(', ')}${suffix}]`;
	}
	if (seen.has(value)) {
		return '[Circular]';
	}
	seen.add(value);

	if (
		'id' in value &&
		typeof value.id === 'string' &&
		'name' in value &&
		typeof value.name === 'string'
	) {
		return `${value.name} (${value.id})`;
	}
	if ('id' in value && typeof value.id === 'string') {
		return value.id;
	}
	if ('field' in value && Array.isArray(value.field)) {
		return `{ field: ${value.field.join('.')} }`;
	}

	const record = value as Record<string, unknown>;
	const entries = Object.entries(record)
		.slice(0, 4)
		.map(([key, entry]) => `${key}: ${formatValue(entry, seen)}`);
	const suffix = Object.keys(record).length > 4 ? ', ...' : '';
	return `{ ${entries.join(', ')}${suffix} }`;
}

function formatDiffValue(
	value: unknown,
	color: string | null,
): string {
	return colorize(formatValue(value), color);
}

function formatPredictedChange(
	change: ChoiceAnalysis['predictedChanges'][number],
): string {
	const hostName = 'name' in change.host ? change.host.name : 'combat';
	const changed = !Object.is(change.before, change.after);
	const before = formatDiffValue(change.before, changed ? ANSI.red : null);
	const after = formatDiffValue(change.after, changed ? ANSI.green : null);
	return `${hostName}.${change.field.join('.')} ${before} -> ${after}`;
}

function isAdvanceInput(
	input: string,
): boolean {
	return input === '\r' ||
		input === '\n' ||
		input === ' ' ||
		input === 'n';
}

function tokenizeInput(
	input: string,
): Array<string> {
	const tokens: Array<string> = [];
	for (let index = 0; index < input.length; index += 1) {
		if (input[index] === '\x1b' && input[index + 1] === '[' && input[index + 2]) {
			tokens.push(input.slice(index, index + 3));
			index += 2;
			continue;
		}
		tokens.push(input[index]);
	}
	return tokens;
}

function entityRow(
	entity: CombatEntity,
	currentActorId: string | null,
): string {
	const teamColor = entity.id.startsWith('party_')
		? ANSI.cyan
		: ANSI.yellow;
	const hpColor = entity.hp <= Math.ceil(entity.maxHp / 3)
		? ANSI.red
		: entity.hp <= Math.floor(entity.maxHp / 2)
			? ANSI.yellow
			: null;
	const currentPrefix = entity.id === currentActorId ? '>' : ' ';
	const deadStyle = entity.isDead ? ANSI.dim : '';
	const name = `${currentPrefix} ${entity.name}`;
	const hp = `${entity.hp}/${entity.maxHp}`;
	const energy = `${entity.energy}/${entity.maxEnergy}`;
	const shields = String(entity.shields);
	const moves = visibleMoveSummary(entity);
	const row = [
		pad(name, 18),
		pad(`L${entity.level}`, 4),
		pad(colorize(hp, hpColor), 10),
		pad(energy, 8),
		pad(shields, 4),
		pad(moves, 6),
		pad(formatAttunements(entity), 10),
		formatStatuses(entity),
	].join(' ');

	return `${deadStyle}${teamColor}${row}${ANSI.reset}`;
}

function formatChoiceLine(
	index: number,
	analysis: ChoiceAnalysis,
): Array<string> {
	const header =
		`${index + 1}. ${analysis.choice.move.name} -> ${formatTargets(analysis)} ` +
		`[score ${analysis.score.toFixed(2)}]`;

	const reasons = analysis.contributions
		.slice(0, 3)
		.map(formatContribution)
		.join(' | ') || 'no meaningful goal contribution';

	const predicted = analysis.predictedChanges
		.slice(0, 4)
		.map(formatPredictedChange);

	const lines = [
		header,
		`   why: ${reasons}`,
	];
	if (predicted.length === 0) {
		lines.push('   diff: no projected changes');
		return lines;
	}

	lines.push('   diff:');
	for (const change of predicted) {
		lines.push(`     - ${change}`);
	}

	return lines;
}

function renderScreen(
	simulation: Simulation,
): string {
	const pending = simulation.pending;
	const currentActorId = pending?.actor.id ?? null;
	const futureNames = pending
		? pending.analysis[0]?.futureActorIds.map(
			(actorId) => findEntity(simulation.combat, actorId)?.name ?? actorId,
		).join(' -> ') || '-'
		: '-';

	const lines: Array<string> = [];
	lines.push(
		`${ANSI.bold}AI Decision TUI${ANSI.reset}  ` +
		`Loop ${simulation.loop}  ` +
		`Level ${simulation.level}  ` +
		`Combat Turn ${simulation.combat.turn}  ` +
		`Priority ${simulation.combat.hasPriority}`,
	);
	lines.push('Press Enter/Space to advance, q to quit.');
	lines.push('');
	lines.push(`${ANSI.bold}Party${ANSI.reset}`);
	lines.push('Name               Lv   HP         EN       SH   Vis    Attune     Statuses');
	for (const entity of simulation.combat.entities.party) {
		lines.push(entityRow(entity, currentActorId));
	}
	lines.push('');
	lines.push(`${ANSI.bold}Encounters${ANSI.reset}`);
	lines.push('Name               Lv   HP         EN       SH   Vis    Attune     Statuses');
	for (const entity of simulation.combat.entities.encounters) {
		lines.push(entityRow(entity, currentActorId));
	}
	lines.push('');

	if (simulation.winner) {
		lines.push(
			`${ANSI.bold}${ANSI.green}Loop ${simulation.loop} complete.${ANSI.reset} Winner: ${simulation.winner}.`,
		);
		lines.push(`Press Enter/Space to start loop ${simulation.loop + 1} at AI level ${simulation.level + 1}.`);
	} else if (pending) {
		lines.push(
			`${ANSI.bold}Current Actor:${ANSI.reset} ${pending.actor.name} ` +
			`(${pending.actor.id.startsWith('party_') ? 'party' : 'encounters'})`,
		);
		lines.push(
			`${ANSI.bold}Decision Time:${ANSI.reset} ${pending.calculationMs}ms   ` +
			`${ANSI.bold}Prediction Depth:${ANSI.reset} ${pending.actor.level}   ` +
			`${ANSI.bold}Future Actors:${ANSI.reset} ${futureNames}`,
		);
		lines.push('');
		lines.push(`${ANSI.bold}Ranked Choices${ANSI.reset}`);
		for (const [index, analysis] of pending.analysis.slice(0, 5).entries()) {
			lines.push(...formatChoiceLine(index, analysis));
		}
		if (pending.analysis.length > 5) {
			lines.push(`   ... ${pending.analysis.length - 5} more choices`);
		}
	}

	lines.push('');
	lines.push(`${ANSI.bold}Log${ANSI.reset}`);
	for (const line of simulation.log) {
		lines.push(line);
	}

	return lines.join('\n');
}

function runInteractiveTui(): void {
	let simulation = createSimulation(1, 1);

	const redraw = (): void => {
		process.stdout.write('\x1b[2J\x1b[H');
		process.stdout.write(`${renderScreen(simulation)}\n`);
	};

	process.stdin.setEncoding('utf8');
	process.stdin.resume();
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}

	const cleanup = (): void => {
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(false);
		}
		process.stdin.removeListener('data', onData);
	};

	const onData = (input: string): void => {
		for (const token of tokenizeInput(input)) {
			if (token === '\u0003') {
				cleanup();
				process.exit(0);
			}

			if (isAdvanceInput(token)) {
				simulation = advanceSimulation(simulation);
				redraw();
				continue;
			}

			if (token === 'q') {
				cleanup();
				process.exit(0);
			}
		}
	};

	process.stdin.on('data', onData);
	redraw();
}

runInteractiveTui();
