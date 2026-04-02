// src/combat/operations/types.ts

import type { DamageElement, Status, EntityType } from '../../shared';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';

export type IntentKind =
	| 'deal_damage'
	| 'apply_status'
	| 'gain_shield'
	| 'modify_cooldown'
	| 'set_hp'
	| 'set_blessing_exhausted'
	| 'set_attunement';

export type CombatEventKind = IntentKind | 'shields_broken';
export type ListenerPhase = 'interrupt' | 'side_effect';

export interface ConstantValue {
	kind: 'constant';
	value: number;
}

export type NumericValue = ConstantValue;

export interface CasterSelector {
	kind: 'caster';
}

export interface SelectedEntitySelector {
	kind: 'selected_entity';
	index: number;
}

export interface ListenerOwnerSelector {
	kind: 'listener_owner';
}

export interface EventTargetEntitySelector {
	kind: 'event_target_entity';
}

export type EntitySelector =
	| CasterSelector
	| SelectedEntitySelector
	| ListenerOwnerSelector
	| EventTargetEntitySelector;

export interface CurrentMoveSelector {
	kind: 'current_move';
}

export type MoveSelector = CurrentMoveSelector;

export interface SelfBlessingSelector {
	kind: 'self_blessing';
}

export type BlessingSelector = SelfBlessingSelector;

export interface DealDamageIntentDefinition {
	kind: 'deal_damage';
	target: EntitySelector;
	amount: NumericValue;
	element: DamageElement;
}

export interface ApplyStatusIntentDefinition {
	kind: 'apply_status';
	target: EntitySelector;
	status: Status;
	turns: NumericValue;
}

export interface GainShieldIntentDefinition {
	kind: 'gain_shield';
	target: EntitySelector;
	amount: NumericValue;
}

export interface ModifyCooldownIntentDefinition {
	kind: 'modify_cooldown';
	target: MoveSelector | BlessingSelector;
	amount: NumericValue;
}

export interface SetHpIntentDefinition {
	kind: 'set_hp';
	target: EntitySelector;
	nextHp: NumericValue;
}

export interface SetBlessingExhaustedIntentDefinition {
	kind: 'set_blessing_exhausted';
	target: BlessingSelector;
	isExhausted: boolean;
}

export interface SetAttunementIntentDefinition {
	kind: 'set_attunement';
	target: EntitySelector;
	element: DamageElement;
	value: boolean;
}

export type IntentDefinition =
	| DealDamageIntentDefinition
	| ApplyStatusIntentDefinition
	| GainShieldIntentDefinition
	| ModifyCooldownIntentDefinition
	| SetHpIntentDefinition
	| SetBlessingExhaustedIntentDefinition
	| SetAttunementIntentDefinition;

export interface EmitIntentStep {
	kind: 'emit_intent';
	intent: IntentDefinition;
}

export interface RepeatStep {
	kind: 'repeat';
	times: NumericValue;
	steps: Array<OperationStep>;
}

export interface BreakSequenceStep {
	kind: 'break_sequence';
}

export type OperationStep = EmitIntentStep | RepeatStep | BreakSequenceStep;

export interface EventTargetIsOwnerCondition {
	kind: 'event_target_is_owner';
}

export interface EventStatusIsCondition {
	kind: 'event_status_is';
	status: Status;
}

export interface WouldReduceTargetHpToOrBelowCondition {
	kind: 'event_would_reduce_target_hp_to_or_below';
	threshold: number;
}

export type ListenerCondition =
	| EventTargetIsOwnerCondition
	| EventStatusIsCondition
	| WouldReduceTargetHpToOrBelowCondition;

export interface CancelCurrentIntentEffect {
	kind: 'cancel_current_intent';
}

export interface SetCurrentIntentTargetHpEffect {
	kind: 'set_current_intent_target_hp';
	hp: NumericValue;
}

export interface EnqueueSideEffectEffect {
	kind: 'enqueue_side_effect';
	intent: IntentDefinition;
}

export interface SetBreakSequenceEffect {
	kind: 'set_break_sequence';
}

export interface RegisterRuntimeListenerEffect {
	kind: 'register_runtime_listener';
	listener: RuntimeListenerDefinition;
}

export interface UnregisterRuntimeListenerEffect {
	kind: 'unregister_runtime_listener';
	listenerId: string;
}

export type BlessingEffectStep =
	| CancelCurrentIntentEffect
	| SetCurrentIntentTargetHpEffect
	| EnqueueSideEffectEffect
	| SetBreakSequenceEffect
	| RegisterRuntimeListenerEffect
	| UnregisterRuntimeListenerEffect;

export interface BlessingListener {
	id: string;
	phase: ListenerPhase;
	trigger: CombatEventKind;
	conditions: Array<ListenerCondition>;
	effects: Array<BlessingEffectStep>;
}

export interface RuntimeListenerDefinition extends BlessingListener {}

export interface RegisteredRuntimeListener {
	id: string;
	owner: CombatEntity | null;
	listener: RuntimeListenerDefinition;
}

export interface DamagePreview {
	previousHp: number;
	nextHp: number;
	previousShields: number;
	nextShields: number;
	amount: number;
	shieldDamage: number;
	hpDamage: number;
	didBreakShields: boolean;
	wasDefeated: boolean;
}

export interface BaseCombatEvent {
	id: string;
	phase: 'attempt' | 'committed';
	kind: CombatEventKind;
	sourceEntity: CombatEntity | null;
	sourceMove: CombatMove | null;
	sourceBlessing: CombatBlessing | null;
	targetEntity?: CombatEntity;
	targetMove?: CombatMove;
	targetBlessing?: CombatBlessing;
	element?: DamageElement;
	status?: Status;
	requestedAmount?: number;
	appliedAmount?: number;
	previousHp?: number;
	nextHp?: number;
	previousShields?: number;
	nextShields?: number;
	didBreakShields?: boolean;
	wasDefeated?: boolean;
}

export interface AttemptCombatEvent extends BaseCombatEvent {
	phase: 'attempt';
}

export interface CommittedCombatEvent extends BaseCombatEvent {
	phase: 'committed';
}

export type CombatEvent = AttemptCombatEvent | CommittedCombatEvent;

export interface IntentBase {
	id: string;
	kind: IntentKind;
	sourceEntity: CombatEntity | null;
	sourceMove: CombatMove | null;
	sourceBlessing: CombatBlessing | null;
	cancelled: boolean;
}

export interface DealDamageIntent extends IntentBase {
	kind: 'deal_damage';
	target: CombatEntity;
	amount: number;
	element: DamageElement;
}

export interface ApplyStatusIntent extends IntentBase {
	kind: 'apply_status';
	target: CombatEntity;
	status: Status;
	turns: number;
}

export interface GainShieldIntent extends IntentBase {
	kind: 'gain_shield';
	target: CombatEntity;
	amount: number;
}

export interface ModifyCooldownIntent extends IntentBase {
	kind: 'modify_cooldown';
	target: CombatMove | CombatBlessing;
	amount: number;
}

export interface SetHpIntent extends IntentBase {
	kind: 'set_hp';
	target: CombatEntity;
	nextHp: number;
}

export interface SetBlessingExhaustedIntent extends IntentBase {
	kind: 'set_blessing_exhausted';
	target: CombatBlessing;
	isExhausted: boolean;
}

export interface SetAttunementIntent extends IntentBase {
	kind: 'set_attunement';
	target: CombatEntity;
	element: DamageElement;
	value: boolean;
}

export type CombatIntent =
	| DealDamageIntent
	| ApplyStatusIntent
	| GainShieldIntent
	| ModifyCooldownIntent
	| SetHpIntent
	| SetBlessingExhaustedIntent
	| SetAttunementIntent;

export interface StepResolutionContext {
	combat: CombatState;
	caster: CombatEntity;
	move: CombatMove | null;
	blessing: CombatBlessing | null;
	selectedEntities: Array<CombatEntity>;
	selectedMoves: Array<CombatMove>;
	selectedBlessings: Array<CombatBlessing>;
	currentEvent?: CombatEvent;
	currentIntent?: CombatIntent;
	listenerOwner?: CombatEntity | null;
}

export interface ExecutionFrame {
	id: string;
	sourceEntity: CombatEntity;
	sourceMove: CombatMove | null;
	sourceBlessing: CombatBlessing | null;
	selectedEntities: Array<CombatEntity>;
	stepIndex: number;
	breakSequence: boolean;
	eventLog: Array<CombatEvent>;
	sideEffectQueue: Array<CombatIntent>;
	maxDepth: number;
	depth: number;
}

export interface ResolutionResult {
	frame: ExecutionFrame;
	events: Array<CombatEvent>;
	breaks: boolean;
}

interface TargetMatrix {
	entities: Array<CombatEntity>;
	moves: Array<CombatMove>;
	blessings: Array<CombatBlessing>;
}

export interface OperationContext {
	caster: CombatEntity;
	move: CombatMove;
	targets: TargetMatrix;
	entityType?: EntityType;
	element?: DamageElement;
	status?: Status;
	amount?: number;
}
