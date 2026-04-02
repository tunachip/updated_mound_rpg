// tests/preview-tui.ts

import * as readline from 'node:readline';
import type { Key } from 'node:readline';

import {
	applyAttunement,
	applyCurseChance,
	applyShields,
	applyStatusTurns,
	attack,
	operation,
	previewOperations,
	selfTargets,
	type StateChange,
} from '../src/combat/operations/index.ts';
import {
	DamageElements,
	Statuses,
	type DamageElement,
	type MoveType,
	type Status,
} from '../src/shared/index.ts';
import type {
	CombatEntity,
	CombatMove,
	TurnChoice,
} from '../src/combat/models/types.ts';
import type { CombatState } from '../src/combat/types.ts';

function makeBooleanRecord<T extends string>(keys: readonly T[]): Record<T, boolean> {
	return Object.fromEntries(keys.map((key) => [key, false])) as Record<T, boolean>;
}

function makeNumberRecord<T extends string>(keys: readonly T[], value = 0): Record<T, number> {
	return Object.fromEntries(keys.map((key) => [key, value])) as Record<T, number>;
}

function makeEntity(
	id: string,
	name: string,
	overrides: Partial<CombatEntity> = {},
): CombatEntity {
	return {
		id,
		name,
		entityType: 'controlled',
		hp: 10,
		maxHp: 10,
		energy: 3,
		maxEnergy: 3,
		shields: 0,
		extraIterations: 0,
		isDead: false,
		shieldsBroken: false,
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
		...overrides,
	};
}

function makeMove(
	owner: CombatEntity,
	id: string,
	name: string,
	description: string,
	moveType: MoveType,
	element: DamageElement,
	operations: Array<CombatMove['operations'][number]>,
): CombatMove {
	return {
		id,
		name,
		description,
		element,
		moveType,
		owner,
		targeting: {
			type: 'enemy',
			range: [1, 1],
		},
		baseDamage: 0,
		baseIterations: 1,
		cooldownTurns: 0,
		currentCooldownTurns: 0,
		isBound: false,
		ignoresStatuses: [],
		operations,
	};
}

function pathLabel(change: StateChange): string {
	return `${change.host.name}.${change.field.join('.')}`;
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
	return `${pathLabel(change)}: ${formatValue(change.before)} -> ${formatValue(change.after)}`;
}

function summarizeEntity(entity: CombatEntity, changes: Array<StateChange>): string[] {
	const relevant = changes.filter((change) => change.host.id === entity.id);
	const current = new Map<string, StateChange>();
	for (const change of relevant) {
		current.set(change.field.join('.'), change);
	}

	const hpChange = current.get('hp');
	const shieldChange = current.get('shields');
	const energyChange = current.get('energy');
	const attunements = DamageElements.filter((element) => {
		const key = `attunedTo.${element}`;
		return current.get(key)?.after === true || (!current.has(key) && entity.attunedTo[element]);
	});
	const statuses = Statuses.filter((status) => {
		const key = `hasStatus.${status}`;
		return current.get(key)?.after === true || (!current.has(key) && entity.hasStatus[status]);
	});

	return [
		`${entity.name}`,
		`  HP      ${hpChange ? `${hpChange.before} -> ${hpChange.after}` : entity.hp}`,
		`  Shields ${shieldChange ? `${shieldChange.before} -> ${shieldChange.after}` : entity.shields}`,
		`  Energy  ${energyChange ? `${energyChange.before} -> ${energyChange.after}` : entity.energy}`,
		`  Attuned ${attunements.length > 0 ? attunements.join(', ') : 'none'}`,
		`  Status  ${statuses.length > 0 ? statuses.join(', ') : 'none'}`,
	];
}

function renderScreen(
	_combat: CombatState,
	caster: CombatEntity,
	target: CombatEntity,
	moves: Array<CombatMove>,
	selectedIndex: number,
): string {
	const selectedMove = moves[selectedIndex];
	const previewSequence = previewOperations(selectedMove.operations, {
		caster,
		move: selectedMove,
		targets: {
			entities: [target],
			moves: [],
			blessings: [],
		},
	});
	const finalPreview = previewSequence[previewSequence.length - 1] ?? [];

	const lines: string[] = [];
	lines.push('Preview TUI');
	lines.push('Use ↑/↓ or j/k to switch moves. Press q to quit.');
	lines.push('');
	lines.push('Move Choices');
	for (let i = 0; i < moves.length; i += 1) {
		const prefix = i === selectedIndex ? '>' : ' ';
		lines.push(`${prefix} ${moves[i].name} | ${moves[i].description}`);
	}
	lines.push('');
	lines.push('Projected Final State');
	lines.push(...summarizeEntity(caster, finalPreview));
	lines.push(...summarizeEntity(target, finalPreview));
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
	caster: CombatEntity;
	target: CombatEntity;
	moves: Array<CombatMove>;
} {
	const caster = makeEntity('entity_player', 'Mosscaller', {
		entityType: 'controlled',
		hp: 9,
		maxHp: 10,
		energy: 3,
		maxEnergy: 3,
		shields: 1,
	});

	const target = makeEntity('entity_enemy', 'Ash Hound', {
		entityType: 'forecasted',
		hp: 11,
		maxHp: 11,
		energy: 2,
		maxEnergy: 2,
		shields: 2,
	});
	target.attunedTo.fire = true;

	const tidalBreak = makeMove(
		caster,
		'move_tidal_break',
		'Tidal Break',
		'Attune to Water, soak the target, then strike.',
		'attack',
		'water',
		[
			operation(applyAttunement, {
				ctx: { element: 'water' },
				targets: selfTargets(),
			}),
			operation(applyStatusTurns, {
				ctx: { status: 'slick', amount: 2 },
			}),
			operation(attack, {
				ctx: { element: 'water', amount: 3 },
			}),
		],
	);

	const emberWard = makeMove(
		caster,
		'move_ember_ward',
		'Ember Ward',
		'Kindle fire, burn the target, then gain shields.',
		'utility',
		'fire',
		[
			operation(applyAttunement, {
				ctx: { element: 'fire' },
				targets: selfTargets(),
			}),
			operation(applyStatusTurns, {
				ctx: { status: 'burn', amount: 2 },
			}),
			operation(attack, {
				ctx: { element: 'fire', amount: 2 },
			}),
			operation(applyShields, {
				ctx: { amount: 2 },
				targets: selfTargets(),
			}),
		],
	);

	const graveNeedle = makeMove(
		caster,
		'move_grave_needle',
		'Grave Needle',
		'Raise curse chance, apply curse, then strike with force.',
		'utility',
		'force',
		[
			operation(applyCurseChance, {
				ctx: { amount: 3 },
			}),
			operation(applyStatusTurns, {
				ctx: { status: 'curse', amount: 1 },
			}),
			operation(attack, {
				ctx: { element: 'force', amount: 2 },
			}),
		],
	);

	const moves = [tidalBreak, emberWard, graveNeedle];
	caster.moves = moves;

	const choiceTargets = {
		entities: [target],
		moves: [],
		blessings: [],
	};
	caster.turnChoices = moves.map((move) => ({
		move,
		targets: choiceTargets,
	})) as Array<TurnChoice>;

	const combat: CombatState = {
		turn: 1,
		entities: {
			party: [caster],
			encounters: [target],
		},
		listeners: [],
		eventLog: [],
	};

	return { combat, caster, target, moves };
}

function runDumpMode(): void {
	const fixture = buildFixture();
	const screen = renderScreen(
		fixture.combat,
		fixture.caster,
		fixture.target,
		fixture.moves,
		0,
	);
	process.stdout.write(`${screen}\n`);
}

function runInteractiveMode(): void {
	const fixture = buildFixture();
	let selectedIndex = 0;

	const redraw = (): void => {
		process.stdout.write('\x1b[2J\x1b[H');
		process.stdout.write(
			`${renderScreen(
				fixture.combat,
				fixture.caster,
				fixture.target,
				fixture.moves,
				selectedIndex,
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
			selectedIndex = (selectedIndex + 1) % fixture.moves.length;
			redraw();
		}
		if (key.name === 'up' || input === 'k') {
			selectedIndex = (selectedIndex - 1 + fixture.moves.length) % fixture.moves.length;
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
