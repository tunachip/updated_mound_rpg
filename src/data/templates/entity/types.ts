// src/data/templates/entity/types.ts

import type { EntityType } from '../../../shared';
import type { MoveTemplate, BlessingTemplate, ItemTemplate, FragmentTemplate} from '..';
import type { AiTuning } from '../../../combat/ai';

export interface EntityTemplate {
	id: string;
	name: string;
	level: number;
	xp: number;
	entityType: EntityType;
	hp: number;
	maxHp: number;
	energy: number;
	maxEnergy: number;
	shields: number;
	aiTuning?: Partial<AiTuning>;
	moves: Array<[MoveTemplate, Array<FragmentTemplate>]>;
	blessings: Array<BlessingTemplate>;
	inventory: Array<ItemTemplate>;
}
