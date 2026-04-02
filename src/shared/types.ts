// src/shared/types.ts

import * as Constants from './constants.ts';

export type DamageElement	= typeof Constants.DamageElements[number];
export type Status				= typeof Constants.Statuses[number];
export type EntityType		= typeof Constants.EntityTypes[number];
export type MoveType			= typeof Constants.MoveTypes[number];
