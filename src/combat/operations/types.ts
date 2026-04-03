// src/combat/operations/types.ts

import type { DamageElement, EntityType, Status, ListenerType } from '../../shared';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';
import type { EntityTemplate } from '../../data/templates';
import type { StateChange, StateChangeSignal } from './diff.ts';

export interface TargetMatrix {
	entities: Array<CombatEntity>;
	moves: Array<CombatMove>;
	blessings: Array<CombatBlessing>;
}

export interface CapturedEntityBoundary {
	team: 'encounters' | 'party';
	leftId: string | null;
	rightId: string | null;
	originalOrder: Array<string>;
}

export interface OperationContext {
	combat: CombatState;
	caster: CombatEntity;
	move: CombatMove | null;
	blessing?: CombatBlessing | null;
	change?: StateChange;
	targets: TargetMatrix;
	entityType?: EntityType;
	element?: DamageElement;
	status?: Status;
	amount?: number;
	operations?: Array<Operation>;
	elseOperations?: Array<Operation>;
	listeners?: Array<Listener>;
	signal?: string;
	changes?: Array<StateChange>;
	template?: EntityTemplate;
	entityTeam?: 'encounters' | 'party';
	entityIndex?: number;
	relativeEntityIndex?: number;
	capturedEntityBoundary?: CapturedEntityBoundary;
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

export interface ListenerContext {
	combat: CombatState;
	owner: CombatEntity;
	blessing: CombatBlessing | null;
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
	phase: ListenerType;
	trigger: StateChangeSignal;
	conditions: Array<ListenerCondition>;
	handler: ListenerHandler;
}

export interface RegisteredRuntimeListener {
	owner: CombatEntity;
	move: CombatMove | null;
	blessing: CombatBlessing | null;
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
