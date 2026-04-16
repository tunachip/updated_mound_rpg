// src/data/templates/move/index.ts

export * from './types.ts';
export * from './basic-attack.ts';
export * from './basic-utility.ts';
export * from './01_roll_tide.ts';
export * from './02_stone_toss.ts';
export * from './03_fire_away.ts';
export * from './04_root_out.ts';
export * from './05_tear_into.ts';
export * from './06_blow_hard.ts';
export * from './07_general_strike.ts';
export * from './11_apply_slippery.ts';
export * from './12_apply_tough.ts';
export * from './13_apply_anger.ts';
export * from './14_apply_regen.ts';
export * from './15_apply_strong.ts';
export * from './16_apply_decay.ts';
export * from './17_apply_focusn.ts';
export * from './21_negate_status.ts';
export * from './22_bank_move.ts';
export * from './23_negate_attunement.ts';
export * from './24_bind_move.ts';
export * from './25_ignore_sleep.ts';
export * from './26_negate_regen.ts';
export * from './27_negate_extra_iterations.ts';

import { RollTide } from './01_roll_tide.ts';
import { StoneToss } from './02_stone_toss.ts';
import { FireAway } from './03_fire_away.ts';
import { RootOut } from './04_root_out.ts';
import { TearInto } from './05_tear_into.ts';
import { BlowHard } from './06_blow_hard.ts';
import { GeneralStrike } from './07_general_strike.ts';
import { ApplySlippery } from './11_apply_slippery.ts';
import { ApplyTough } from './12_apply_tough.ts';
import { ApplyAnger } from './13_apply_anger.ts';
import { ApplyRegen } from './14_apply_regen.ts';
import { ApplyStrong } from './15_apply_strong.ts';
import { ApplyDecay } from './16_apply_decay.ts';
import { ApplyFocus } from './17_apply_focusn.ts';
import { NegateAnger } from './21_negate_status.ts';
import { BankMove } from './22_bank_move.ts';
import { NegateThunderAttunement } from './23_negate_attunement.ts';
import { BindMove } from './24_bind_move.ts';
import { IgnoreSleep } from './25_ignore_sleep.ts';
import { NegateRegen } from './26_negate_regen.ts';
import { NegateExtraIterations } from './27_negate_extra_iterations.ts';

export const BasicAttackMoves = [
	RollTide,
	StoneToss,
	FireAway,
	RootOut,
	TearInto,
	BlowHard,
	GeneralStrike,
];

export const UtilityMoveTemplates = [
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
];

export const AllMoveTemplates = [
	...BasicAttackMoves,
	...UtilityMoveTemplates,
];

export const MoveTemplatesById = new Map(
	AllMoveTemplates.map((move) => [move.id, move] as const),
);
