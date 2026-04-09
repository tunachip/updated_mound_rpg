// src/data/templates/blessing/index.ts

export * from './types.ts';
export * from './01_slippery.ts';
export * from './02_unbreakable.ts';
export * from './03_geothermal.ts';

import { Slippery } from './01_slippery.ts';
import { Unbreakable } from './02_unbreakable.ts';
import { Geothermal } from './03_geothermal.ts';

export const BlessingTemplates = [
	Slippery,
	Unbreakable,
	Geothermal,
];

export const BlessingTemplatesById = new Map(
	BlessingTemplates.map((blessing) => [blessing.id, blessing] as const),
);
