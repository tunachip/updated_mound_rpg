// src/data/templates/entity/types.ts

import type { EntityType } from '../../../shared';
import type { MoveTemplate, BlessingTemplate, ItemTemplate, FragmentTemplate} from '..';

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
	moves: Array<[MoveTemplate, Array<FragmentTemplate>]>;
	blessings: Array<BlessingTemplate>;
	inventory: Array<ItemTemplate>;
}
