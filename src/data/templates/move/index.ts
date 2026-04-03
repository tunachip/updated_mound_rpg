// src/data/templates/move/index.ts

export * from './types.ts';
export * from './basic-attack.ts';
export * from './01_roll_tide.ts';
export * from './02_stone_toss.ts';
export * from './03_fire_away.ts';
export * from './04_root_out.ts';
export * from './05_tear_into.ts';
export * from './06_blow_hard.ts';
export * from './07_general_strike.ts';

import { RollTide } from './01_roll_tide.ts';
import { StoneToss } from './02_stone_toss.ts';
import { FireAway } from './03_fire_away.ts';
import { RootOut } from './04_root_out.ts';
import { TearInto } from './05_tear_into.ts';
import { BlowHard } from './06_blow_hard.ts';
import { GeneralStrike } from './07_general_strike.ts';

export const BasicAttackMoves = [
	RollTide,
	StoneToss,
	FireAway,
	RootOut,
	TearInto,
	BlowHard,
	GeneralStrike,
];
