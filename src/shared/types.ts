// src/shared/types.ts

import * as Constants from './constants.ts';

export type DamageElement				= typeof Constants.DamageElements[number];
export type Status							= typeof Constants.Statuses[number];
export type EntityType					= typeof Constants.EntityTypes[number];
export type MoveType						= typeof Constants.MoveTypes[number];
export type ListenerType				= typeof Constants.ListenerTypes[number];
export type TargetType					= typeof Constants.TargetTypes[number];
export type ModifierExpression  = typeof Constants.ModifierExpressions[number];
export type CombatTeam 					= typeof Constants.CombatTeams[number];
