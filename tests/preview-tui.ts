// tests/preview-tui.ts

import * as readline from 'node:readline';
import type { Key } from 'node:readline';

import { defaultAiTuning } from '../src/combat/ai/goals.ts';
import { buildCombatMove } from '../src/combat/models/constructor.ts';
import { previewOperations, type StateChange } from '../src/combat/operations/index.ts';
import { BasicAttackMoves } from '../src/data/templates/move/index.ts';
import { DamageElements, Statuses, type DamageElement, type Status } from '../src/shared/index.ts';
import type { CombatEntity, CombatMove, TurnChoice } from '../src/combat/models/types.ts';
import type { CombatState } from '../src/combat/types.ts';

const ANSI = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	cyan: '\x1b[36m',
};

type CellTone = 'green' | 'red' | 'yellow' | null;

interface TableColumn {
	label: string;
	width: number;
	render: (entity: CombatEntity, changes: Array<StateChange>) => {
		value: string;
		tone: CellTone;
	};
}

function makeBooleanRecord <T extends string> (
	keys: readonly T[]
): Record<T, boolean> {
	return Object.fromEntries(keys.map(
		(key) => [key, false])) as Record<T, boolean>;
}

function makeNumberRecord <T extends string> (
	keys: readonly T[],
	value = 0
): Record<T, number> {
	return Object.fromEntries(keys.map(
		(key) => [key, value])) as Record<T, number>;
}

function makeEntity(
	id: string,
	name: string,
	overrides: Partial<CombatEntity> = {},
): CombatEntity {
	return {
		id,
		name,
		level: 1,
		entityType: 'controlled',
		hp: 10,
		maxHp: 20,
		energy: 3,
		maxEnergy: 3,
		shields: 0,
		extraIterations: 0,
		isDead: false,
		shieldsBroken: false,
		isBloody: false,
		curseChance: 0,
		attunedTo: makeBooleanRecord(DamageElements),
		turnsAttuned: makeNumberRecord(DamageElements),
		hasStatus: makeBooleanRecord(Statuses),
		statusTurns: makeNumberRecord(Statuses),
		statusMaxTurns: makeNumberRecord(Statuses, 9),
		ignoresStatusTurns: makeNumberRecord(Statuses),
		maxDamageTaken: 0,
		lastDamageTaken: 0,
		totalDamageTaken: 0,
		moves: [],
		blessings: [],
		turnChoices: [],
		dodges: 0,
		knowledge: [],
		aiTuning: defaultAiTuning,
		goals: [],
		...overrides,
	};
}

function changeHostLabel(change: StateChange): string {
	if ('name' in change.host) {
		return change.host.name;
	}
	return 'combat';
}

function formatValue(value: unknown): string {
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}
	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}
	return JSON.stringify(value);
}

function formatChange(change: StateChange): string {
	return `${changeHostLabel(change)}.${change.field.join('.')}: ${formatValue(change.before)} -> ${formatValue(change.after)}`;
}

function readAtPath(source: unknown, path: Array<string>): unknown {
	let current = source;
	for (const key of path) {
		if (current == null || typeof current !== 'object') {
			return undefined;
		}
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

function getProjectedValue(
	entity: CombatEntity,
	path: Array<string>,
	changes: Array<StateChange>,
): unknown {
	for (let i = changes.length - 1; i >= 0; i -= 1) {
		const change = changes[i];
		if (!('id' in change.host) || change.host.id !== entity.id) {
			continue;
		}
		if (change.field.join('.') === path.join('.')) {
			return change.after;
		}
	}
	return readAtPath(entity, path);
}

function latestEntityChange(
	entity: CombatEntity,
	path: Array<string>,
	changes: Array<StateChange>,
): StateChange | null {
	for (let i = changes.length - 1; i >= 0; i -= 1) {
		const change = changes[i];
		if (!('id' in change.host) || change.host.id !== entity.id) {
			continue;
		}
		if (change.field.join('.') === path.join('.')) {
			return change;
		}
	}
	return null;
}

function cellToneFromChange(
	change: StateChange | null,
): CellTone {
	if (!change) {
		return null;
	}
	if (typeof change.before === 'number' && typeof change.after === 'number') {
		if (change.after > change.before) {
			return 'green';
		}
		if (change.after < change.before) {
			return 'red';
		}
		return null;
	}
	if (typeof change.before === 'boolean' && typeof change.after === 'boolean') {
		if (change.before === false && change.after === true) {
			return 'green';
		}
		if (change.before === true && change.after === false) {
			return 'red';
		}
		return null;
	}
	return change.before !== change.after ? 'yellow' : null;
}

function statusDisplay(
	entity: CombatEntity,
	changes: Array<StateChange>,
	status: Status,
): { value: string; tone: CellTone } {
	const has = getProjectedValue(entity, ['hasStatus', status], changes) === true;
	const turns = getProjectedValue(entity, ['statusTurns', status], changes);
	const hasChange = latestEntityChange(entity, ['hasStatus', status], changes);
	const turnChange = latestEntityChange(entity, ['statusTurns', status], changes);
	return {
		value: has ? String(turns) : '.',
		tone: cellToneFromChange(turnChange) ?? cellToneFromChange(hasChange),
	};
}

function simpleFieldColumn(
	label: string,
	width: number,
	path: Array<string>,
): TableColumn {
	return {
		label,
		width,
		render: (entity, changes) => {
			const change = latestEntityChange(entity, path, changes);
			const value = getProjectedValue(entity, path, changes);
			return {
				value: typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
				tone: cellToneFromChange(change),
			};
		},
	};
}

function attunementColumn(
	element: DamageElement,
): TableColumn {
	return {
		label: element.slice(0, 2).toUpperCase(),
		width: 2,
		render: (entity, changes) => {
			const path = ['attunedTo', element];
			const change = latestEntityChange(entity, path, changes);
			const value = getProjectedValue(entity, path, changes) === true ? '1' : '.';
			return {
				value,
				tone: cellToneFromChange(change),
			};
		},
	};
}

const STATUS_LABELS: Record<Status, string> = {
	burn: 'BU',
	decay: 'DE',
	wound: 'WO',
	curse: 'CU',
	regen: 'RE',
	focus: 'FC',
	strong: 'SG',
	tough: 'TG',
	slick: 'SL',
	barbs: 'BA',
	anger: 'AN',
	stun: 'ST',
	sleep: 'SP',
	sick: 'SI',
};

function statusColumn(
	status: Status,
): TableColumn {
	return {
		label: STATUS_LABELS[status],
		width: 2,
		render: (entity, changes) => statusDisplay(entity, changes, status),
	};
}

function padCell(value: string, width: number): string {
	if (value.length >= width) {
		return value.slice(0, width);
	}
	return `${value}${' '.repeat(width - value.length)}`;
}

function colorCell(
	value: string,
	tone: CellTone,
): string {
	switch (tone) {
		case 'green':
			return `${ANSI.green}${value}${ANSI.reset}`;
		case 'red':
			return `${ANSI.red}${value}${ANSI.reset}`;
		case 'yellow':
			return `${ANSI.yellow}${value}${ANSI.reset}`;
		default:
			return value;
	}
}

function renderTable(
	entities: Array<CombatEntity>,
	changes: Array<StateChange>,
	selectedTargetId: string,
): string[] {
	const columns: Array<TableColumn> = [
		simpleFieldColumn('HP', 3, ['hp']),
		simpleFieldColumn('MH', 3, ['maxHp']),
		simpleFieldColumn('EN', 3, ['energy']),
		simpleFieldColumn('ME', 3, ['maxEnergy']),
		simpleFieldColumn('SH', 3, ['shields']),
		simpleFieldColumn('IT', 3, ['extraIterations']),
		simpleFieldColumn('DG', 3, ['dodges']),
		simpleFieldColumn('CU%', 3, ['curseChance']),
		simpleFieldColumn('DE', 2, ['isDead']),
		simpleFieldColumn('BR', 2, ['shieldsBroken']),
		simpleFieldColumn('LD', 3, ['lastDamageTaken']),
		simpleFieldColumn('MD', 3, ['maxDamageTaken']),
		simpleFieldColumn('TD', 3, ['totalDamageTaken']),
		...DamageElements.map(attunementColumn),
		...Statuses.map(statusColumn),
	];

	const nameWidth = Math.max(...entities.map((entity) => entity.name.length), 'Entity'.length) + 2;
	const header = [
		`${ANSI.bold}${padCell('Entity', nameWidth)}${ANSI.reset}`,
		...columns.map((column) =>
			`${ANSI.bold}${padCell(column.label, column.width)}${ANSI.reset}`,
		),
	].join(' ');

	const rows = entities.map((entity) => {
		const nameCell = padCell(
			entity.id === selectedTargetId ? `> ${entity.name}` : `  ${entity.name}`,
			nameWidth,
		);
		const styledName = entity.id === selectedTargetId
			? `${ANSI.cyan}${ANSI.bold}${nameCell}${ANSI.reset}`
			: nameCell;
		const cells = columns.map((column) => {
			const cell = column.render(entity, changes);
			return colorCell(padCell(cell.value, column.width), cell.tone);
		});
		return [styledName, ...cells].join(' ');
	});

	return [header, ...rows];
}

function renderScreen(
	combat: CombatState,
	player: CombatEntity,
	encounters: Array<CombatEntity>,
	moves: Array<CombatMove>,
	selectedMoveIndex: number,
	selectedTargetIndex: number,
): string {
	const selectedMove = moves[selectedMoveIndex];
	const selectedTarget = encounters[selectedTargetIndex];
	const previewSequence = previewOperations(selectedMove.operations, {
		combat,
		caster: player,
		move: selectedMove,
		targets: {
			entities: [selectedTarget],
			moves: [],
			blessings: [],
		},
	});
	const finalPreview = previewSequence[previewSequence.length - 1] ?? [];

	const lines: string[] = [];
	lines.push('Preview TUI');
	lines.push('Move: ↑/↓ or j/k | Target: ←/→ or h/l | q to quit');
	lines.push('');
	lines.push('Basic Attacks');
	for (let i = 0; i < moves.length; i += 1) {
		const prefix = i === selectedMoveIndex ? '>' : ' ';
		lines.push(`${prefix} ${moves[i].name} | ${moves[i].element} | dmg ${moves[i].baseDamage} | iter ${moves[i].baseIterations}`);
	}
	lines.push('');
	lines.push('Targets');
	for (let i = 0; i < encounters.length; i += 1) {
		const prefix = i === selectedTargetIndex ? '>' : ' ';
		lines.push(`${prefix} ${encounters[i].name}`);
	}
	lines.push('');
	lines.push(`Selected Preview: ${selectedMove.name} -> ${selectedTarget.name}`);
	lines.push('');
	lines.push('Projected Board');
	lines.push(...renderTable([player, ...encounters], finalPreview, selectedTarget.id));
	lines.push('');
	lines.push('Diff Sequence');

	if (previewSequence.length === 0) {
		lines.push('  No projected changes.');
		return lines.join('\n');
	}

	for (let i = 0; i < previewSequence.length; i += 1) {
		lines.push(`  Step ${i + 1}`);
		for (const change of previewSequence[i]) {
			lines.push(`    - ${formatChange(change)}`);
		}
	}

	return lines.join('\n');
}

function buildFixture(): {
	combat: CombatState;
	player: CombatEntity;
	encounters: Array<CombatEntity>;
	moves: Array<CombatMove>;
} {
	const player = makeEntity('entity_player', 'Mosscaller', {
		entityType: 'controlled',
		hp: 18,
		maxHp: 18,
		energy: 7,
		maxEnergy: 7,
	});

	const encounters = DamageElements.map((element, index) => {
		const maxHp = 12 + index;
		const encounter = makeEntity(
			`entity_enemy_${element}`,
			`${element[0].toUpperCase()}${element.slice(1)} Eidolon`,
			{
				entityType: 'forecasted',
				hp: maxHp,
				maxHp,
				energy: 2,
				maxEnergy: 2,
				shields: index % 3,
			});
		encounter.attunedTo[element] = true;
		return encounter;
	});

	const moves = BasicAttackMoves.map((template) =>
		buildCombatMove(template, [], player),
	);
	player.moves = moves;

	const defaultTargeting = {
		entities: [encounters[0]],
		moves: [],
		blessings: [],
	};
	player.turnChoices = moves.map((move) => ({
		move,
		targets: defaultTargeting,
	})) as Array<TurnChoice>;

	const combat: CombatState = {
		turn: 1,
		hasPriority: 'party',
		entities: {
			party: [player],
			encounters,
		},
		listeners: [],
		eventLog: [],
		aiCache: null,
	};

	return { combat, player, encounters, moves };
}

function runDumpMode(): void {
	const fixture = buildFixture();
	const screen = renderScreen(
		fixture.combat,
		fixture.player,
		fixture.encounters,
		fixture.moves,
		0,
		0,
	);
	process.stdout.write(`${screen}\n`);
}

function runInteractiveMode(): void {
	const fixture = buildFixture();
	let selectedMoveIndex = 0;
	let selectedTargetIndex = 0;

	const redraw = (): void => {
		process.stdout.write('\x1b[2J\x1b[H');
		process.stdout.write(
			`${renderScreen(
				fixture.combat,
				fixture.player,
				fixture.encounters,
				fixture.moves,
				selectedMoveIndex,
				selectedTargetIndex,
			)}\n`,
		);
	};

	readline.emitKeypressEvents(process.stdin);
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}

	const cleanup = (): void => {
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(false);
		}
		process.stdin.removeAllListeners('keypress');
	};

	process.stdin.on('keypress', (input: string, key: Key) => {
		if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
			cleanup();
			process.stdout.write('\n');
			process.exit(0);
		}
		if (key.name === 'down' || input === 'j') {
			selectedMoveIndex = (selectedMoveIndex + 1) % fixture.moves.length;
			redraw();
		}
		if (key.name === 'up' || input === 'k') {
			selectedMoveIndex = (selectedMoveIndex - 1 + fixture.moves.length) % fixture.moves.length;
			redraw();
		}
		if (key.name === 'right' || input === 'l') {
			selectedTargetIndex = (selectedTargetIndex + 1) % fixture.encounters.length;
			redraw();
		}
		if (key.name === 'left' || input === 'h') {
			selectedTargetIndex = (selectedTargetIndex - 1 + fixture.encounters.length) % fixture.encounters.length;
			redraw();
		}
	});

	redraw();
}

if (process.argv.includes('--dump')) {
	runDumpMode();
} else {
	runInteractiveMode();
}
