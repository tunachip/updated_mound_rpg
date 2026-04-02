// src/combat/operations/types.ts

import type { DamageElement, EntityType, Status } from '../../shared';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';
import type { StateChange, StateChangeSignal } from './diff.ts';

export interface TargetMatrix {
	entities: Array<CombatEntity>;
	moves: Array<CombatMove>;
	blessings: Array<CombatBlessing>;
}

export interface OperationContext {
	caster: CombatEntity;
	move: CombatMove | null;
	blessing?: CombatBlessing | null;
	change?: StateChange;
	targets: TargetMatrix;
	entityType?: EntityType;
	element?: DamageElement;
	status?: Status;
	amount?: number;
}

export type OperationHandler = (ctx: OperationContext) => Array<StateChange>;
export type TargetResolver = (ctx: OperationContext) => TargetMatrix;

export interface Operation {
	name: string;
	handler: OperationHandler;
	ctx?: Partial<Omit<OperationContext, 'caster' | 'move' | 'blessing' | 'change' | 'targets'>>;
	resolveTargets?: TargetResolver;
	breaks?: boolean;
}

export type ListenerPhase = 'interrupt' | 'side_effect';

export interface ListenerContext {
	combat: CombatState;
	owner: CombatEntity;
	blessing: CombatBlessing;
	change: StateChange;
	move: CombatMove | null;
	cancel: boolean;
	breakSequence: boolean;
	sideEffects: Array<StateChange>;
}

export type ListenerCondition = (ctx: ListenerContext) => boolean;
export type ListenerHandler = (ctx: ListenerContext) => void;

export interface Listener {
	id: string;
	phase: ListenerPhase;
	trigger: StateChangeSignal;
	conditions: Array<ListenerCondition>;
	handler: ListenerHandler;
}

export interface RegisteredRuntimeListener {
	owner: CombatEntity;
	blessing: CombatBlessing;
	listener: Listener;
}

export interface OperationResult {
	changes: Array<StateChange>;
	breaks: boolean;
}

export type PreviewSequence = Array<Array<StateChange>>;

export interface ResolutionResult {
	applied: Array<StateChange>;
	cancelled: Array<StateChange>;
	breaks: boolean;
}
