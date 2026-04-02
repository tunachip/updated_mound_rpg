// src/combat/operations/resolver.ts

import type {
	BlessingEffectStep,
	BlessingListener,
	CombatEvent,
	CombatEventKind,
	CombatIntent,
	CommittedCombatEvent,
	DamagePreview,
	EntitySelector,
	ExecutionFrame,
	IntentDefinition,
	ListenerCondition,
	NumericValue,
	OperationStep,
	ResolutionResult,
	StepResolutionContext,
} from './types.ts';
import type { CombatBlessing, CombatEntity, CombatMove } from '../models';
import type { CombatState } from '../types.ts';

let nextId = 0;

function createId(prefix: string): string {
	nextId += 1;
	return `${prefix}_${nextId}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function resolveNumericValue(value: NumericValue): number {
	return value.value;
}

function resolveEntitySelector(
	selector: EntitySelector,
	ctx: StepResolutionContext,
): CombatEntity {
	switch (selector.kind) {
		case 'caster':
			return ctx.caster;
		case 'selected_entity': {
			const entity = ctx.selectedEntities[selector.index];
			if (!entity) {
				throw new Error(`Missing selected entity at index ${selector.index}.`);
			}
			return entity;
		}
		case 'listener_owner':
			if (!ctx.listenerOwner) {
				throw new Error('Listener owner selector used without listener owner context.');
			}
			return ctx.listenerOwner;
		case 'event_target_entity':
			if (!ctx.currentEvent?.targetEntity) {
				throw new Error('Event target entity selector used without event target context.');
			}
			return ctx.currentEvent.targetEntity;
	}
}

function resolveIntentDefinition(
	definition: IntentDefinition,
	ctx: StepResolutionContext,
): CombatIntent {
	const sourceEntity = ctx.blessing?.owner ?? ctx.caster ?? null;
	const sourceMove = ctx.move;
	const sourceBlessing = ctx.blessing;

	switch (definition.kind) {
		case 'deal_damage':
			return {
				id: createId('intent'),
				kind: 'deal_damage',
				sourceEntity,
				sourceMove,
				sourceBlessing,
				cancelled: false,
				target: resolveEntitySelector(definition.target, ctx),
				amount: resolveNumericValue(definition.amount),
				element: definition.element,
			};
		case 'apply_status':
			return {
				id: createId('intent'),
				kind: 'apply_status',
				sourceEntity,
				sourceMove,
				sourceBlessing,
				cancelled: false,
				target: resolveEntitySelector(definition.target, ctx),
				status: definition.status,
				turns: resolveNumericValue(definition.turns),
			};
		case 'gain_shield':
			return {
				id: createId('intent'),
				kind: 'gain_shield',
				sourceEntity,
				sourceMove,
				sourceBlessing,
				cancelled: false,
				target: resolveEntitySelector(definition.target, ctx),
				amount: resolveNumericValue(definition.amount),
			};
		case 'modify_cooldown': {
			const amount = resolveNumericValue(definition.amount);
			if (definition.target.kind === 'current_move') {
				if (!ctx.move) {
					throw new Error('Current move selector used without an active move.');
				}
				return {
					id: createId('intent'),
					kind: 'modify_cooldown',
					sourceEntity,
					sourceMove,
					sourceBlessing,
					cancelled: false,
					target: ctx.move,
					amount,
				};
			}
			if (!ctx.blessing) {
				throw new Error('Self blessing selector used without an active blessing.');
			}
			return {
				id: createId('intent'),
				kind: 'modify_cooldown',
				sourceEntity,
				sourceMove,
				sourceBlessing,
				cancelled: false,
				target: ctx.blessing,
				amount,
			};
		}
		case 'set_hp':
			return {
				id: createId('intent'),
				kind: 'set_hp',
				sourceEntity,
				sourceMove,
				sourceBlessing,
				cancelled: false,
				target: resolveEntitySelector(definition.target, ctx),
				nextHp: resolveNumericValue(definition.nextHp),
			};
		case 'set_blessing_exhausted':
			if (!ctx.blessing) {
				throw new Error('Self blessing selector used without an active blessing.');
			}
			return {
				id: createId('intent'),
				kind: 'set_blessing_exhausted',
				sourceEntity,
				sourceMove,
				sourceBlessing,
				cancelled: false,
				target: ctx.blessing,
				isExhausted: definition.isExhausted,
			};
		case 'set_attunement':
			return {
				id: createId('intent'),
				kind: 'set_attunement',
				sourceEntity,
				sourceMove,
				sourceBlessing,
				cancelled: false,
				target: resolveEntitySelector(definition.target, ctx),
				element: definition.element,
				value: definition.value,
			};
	}
}

function previewDamage(intent: CombatIntent): DamagePreview | null {
	if (intent.kind !== 'deal_damage') {
		return null;
	}

	const previousHp = intent.target.hp;
	const previousShields = intent.target.shields;
	const shieldDamage = Math.min(previousShields, intent.amount);
	const hpDamage = Math.max(intent.amount - shieldDamage, 0);
	const nextShields = previousShields - shieldDamage;
	const nextHp = clamp(previousHp - hpDamage, 0, intent.target.maxHp);

	return {
		previousHp,
		nextHp,
		previousShields,
		nextShields,
		amount: intent.amount,
		shieldDamage,
		hpDamage,
		didBreakShields: previousShields > 0 && nextShields === 0,
		wasDefeated: nextHp <= 0,
	};
}

function createAttemptEvent(intent: CombatIntent): CombatEvent {
	switch (intent.kind) {
		case 'deal_damage': {
			const preview = previewDamage(intent);
			return {
				id: createId('event'),
				phase: 'attempt',
				kind: 'deal_damage',
				sourceEntity: intent.sourceEntity,
				sourceMove: intent.sourceMove,
				sourceBlessing: intent.sourceBlessing,
				targetEntity: intent.target,
				element: intent.element,
				requestedAmount: intent.amount,
				previousHp: preview?.previousHp,
				nextHp: preview?.nextHp,
				previousShields: preview?.previousShields,
				nextShields: preview?.nextShields,
				didBreakShields: preview?.didBreakShields,
				wasDefeated: preview?.wasDefeated,
			};
		}
		case 'apply_status':
			return {
				id: createId('event'),
				phase: 'attempt',
				kind: 'apply_status',
				sourceEntity: intent.sourceEntity,
				sourceMove: intent.sourceMove,
				sourceBlessing: intent.sourceBlessing,
				targetEntity: intent.target,
				status: intent.status,
				requestedAmount: intent.turns,
			};
		case 'gain_shield':
			return {
				id: createId('event'),
				phase: 'attempt',
				kind: 'gain_shield',
				sourceEntity: intent.sourceEntity,
				sourceMove: intent.sourceMove,
				sourceBlessing: intent.sourceBlessing,
				targetEntity: intent.target,
				requestedAmount: intent.amount,
				previousShields: intent.target.shields,
				nextShields: intent.target.shields + intent.amount,
			};
		case 'modify_cooldown':
			return {
				id: createId('event'),
				phase: 'attempt',
				kind: 'modify_cooldown',
				sourceEntity: intent.sourceEntity,
				sourceMove: intent.sourceMove,
				sourceBlessing: intent.sourceBlessing,
				targetMove: 'steps' in intent.target ? intent.target : undefined,
				targetBlessing: 'listeners' in intent.target ? intent.target : undefined,
				requestedAmount: intent.amount,
			};
		case 'set_hp':
			return {
				id: createId('event'),
				phase: 'attempt',
				kind: 'set_hp',
				sourceEntity: intent.sourceEntity,
				sourceMove: intent.sourceMove,
				sourceBlessing: intent.sourceBlessing,
				targetEntity: intent.target,
				previousHp: intent.target.hp,
				nextHp: intent.nextHp,
			};
		case 'set_blessing_exhausted':
			return {
				id: createId('event'),
				phase: 'attempt',
				kind: 'set_blessing_exhausted',
				sourceEntity: intent.sourceEntity,
				sourceMove: intent.sourceMove,
				sourceBlessing: intent.sourceBlessing,
				targetBlessing: intent.target,
				appliedAmount: intent.isExhausted ? 1 : 0,
			};
		case 'set_attunement':
			return {
				id: createId('event'),
				phase: 'attempt',
				kind: 'set_attunement',
				sourceEntity: intent.sourceEntity,
				sourceMove: intent.sourceMove,
				sourceBlessing: intent.sourceBlessing,
				targetEntity: intent.target,
				element: intent.element,
				appliedAmount: intent.value ? 1 : 0,
			};
	}
}

function allEntities(
	combat: CombatState
): Array<CombatEntity> {
	return [
		...combat.entities.party,
		...combat.entities.encounters
	];
}

interface ListenerReply {
	blessing: CombatBlessing | null;
	owner: CombatEntity | null;
	listener: BlessingListener;
}

function getMatchingListeners(
	combat: CombatState,
	phase: 'interrupt' | 'side_effect',
	trigger: CombatEventKind,
	event: CombatEvent,
): Array<ListenerReply> {
	const matches: Array<ListenerReply> = [];

	for (const entity of allEntities(combat)) {
		for (const blessing of entity.blessings) {
			if (blessing.isExhausted || blessing.currentCooldownTurns > 0) {
				continue;
			}
			for (const listener of blessing.listeners) {
				if (listener.phase !== phase || listener.trigger !== trigger) {
					continue;
				}
				if (listener.conditions.every((condition) => meetsCondition(condition, event, blessing.owner))) {
					matches.push({ blessing, owner: blessing.owner, listener });
				}
			}
		}
	}

	for (const registration of combat.runtimeListeners) {
		const listener = registration.listener;
		if (listener.phase !== phase || listener.trigger !== trigger) {
			continue;
		}
		if (listener.conditions.every((condition) => meetsCondition(condition, event, registration.owner))) {
			matches.push({
				blessing: null,
				owner: registration.owner,
				listener,
			});
		}
	}
	return matches;
}

function meetsCondition(
	condition: ListenerCondition,
	event: CombatEvent,
	owner: CombatEntity | null,
): boolean {
	switch (condition.kind) {
		case 'event_target_is_owner':
			return Boolean(owner && event.targetEntity && owner.id === event.targetEntity.id);
		case 'event_status_is':
			return event.status === condition.status;
		case 'event_would_reduce_target_hp_to_or_below':
			return typeof event.nextHp === 'number' && event.nextHp <= condition.threshold;
	}
}

function setIntentTargetHp(
	intent: CombatIntent,
	hp: number
): void {
	if (intent.kind === 'set_hp') {
		intent.nextHp = clamp(hp, 0, intent.target.maxHp);
		return;
	}
	if (intent.kind !== 'deal_damage') {
		throw new Error(`Cannot set target hp for intent kind ${intent.kind}.`);
	}
	const desiredHp = clamp(hp, 0, intent.target.maxHp);
	const maxNeededDamage = intent.target.shields + intent.target.hp - desiredHp;
	intent.amount = Math.max(0, maxNeededDamage);
}

function applyBlessingEffects(
	effects: Array<BlessingEffectStep>,
	ctx: StepResolutionContext,
	frame: ExecutionFrame,
): void {
	for (const effect of effects) {
		switch (effect.kind) {
			case 'cancel_current_intent':
				if (!ctx.currentIntent) {
					throw new Error('Tried to cancel an intent without an active intent.');
				}
				ctx.currentIntent.cancelled = true;
				break;
			case 'set_current_intent_target_hp':
				if (!ctx.currentIntent) {
					throw new Error('Tried to rewrite intent hp without an active intent.');
				}
				setIntentTargetHp(ctx.currentIntent, resolveNumericValue(effect.hp));
				break;
			case 'enqueue_side_effect':
				frame.sideEffectQueue.push(resolveIntentDefinition(effect.intent, ctx));
				break;
			case 'set_break_sequence':
				frame.breakSequence = true;
				break;
			case 'register_runtime_listener':
				ctx.combat.runtimeListeners.push({
					id: effect.listener.id,
					owner: ctx.listenerOwner ?? null,
					listener: effect.listener,
				});
				break;
			case 'unregister_runtime_listener':
				ctx.combat.runtimeListeners = ctx.combat.runtimeListeners.filter(
					(listener) => listener.id !== effect.listenerId,
				);
				break;
		}
	}
}

function commitIntent(
	intent: CombatIntent,
): Array<CommittedCombatEvent> {
	switch (intent.kind) {
		case 'deal_damage': {
			const preview = previewDamage(intent);
			if (!preview) {
				return [];
			}
			intent.target.shields = preview.nextShields;
			intent.target.hp = preview.nextHp;
			intent.target.isBroken = preview.didBreakShields;
			intent.target.lastDamageTaken = preview.hpDamage;
			intent.target.totalDamageTaken += preview.hpDamage;
			intent.target.maxDamageTaken = Math.max(intent.target.maxDamageTaken, preview.hpDamage);
			intent.target.isDead = preview.wasDefeated;

			const events: Array<CommittedCombatEvent> = [
				{
					id: createId('event'),
					phase: 'committed',
					kind: 'deal_damage',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetEntity: intent.target,
					element: intent.element,
					requestedAmount: intent.amount,
					appliedAmount: preview.hpDamage,
					previousHp: preview.previousHp,
					nextHp: preview.nextHp,
					previousShields: preview.previousShields,
					nextShields: preview.nextShields,
					didBreakShields: preview.didBreakShields,
					wasDefeated: preview.wasDefeated,
				},
			];

			if (preview.didBreakShields) {
				events.push({
					id: createId('event'),
					phase: 'committed',
					kind: 'shields_broken',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetEntity: intent.target,
					previousShields: preview.previousShields,
					nextShields: preview.nextShields,
				});
			}

			return events;
		}
		case 'apply_status':
			intent.target.hasStatus[intent.status] = true;
			intent.target.statusTurns[intent.status] += intent.turns;
			intent.target.statusMaxTurns[intent.status] = Math.max(
				intent.target.statusMaxTurns[intent.status],
				intent.target.statusTurns[intent.status],
			);
			return [
				{
					id: createId('event'),
					phase: 'committed',
					kind: 'apply_status',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetEntity: intent.target,
					status: intent.status,
					requestedAmount: intent.turns,
					appliedAmount: intent.turns,
				},
			];
		case 'gain_shield': {
			const previousShields = intent.target.shields;
			intent.target.shields += intent.amount;
			return [
				{
					id: createId('event'),
					phase: 'committed',
					kind: 'gain_shield',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetEntity: intent.target,
					requestedAmount: intent.amount,
					appliedAmount: intent.amount,
					previousShields,
					nextShields: intent.target.shields,
				},
			];
		}
		case 'modify_cooldown':
			intent.target.currentCooldownTurns = Math.max(
				0,
				intent.target.currentCooldownTurns + intent.amount,
			);
			return [
				{
					id: createId('event'),
					phase: 'committed',
					kind: 'modify_cooldown',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetMove: 'steps' in intent.target ? intent.target : undefined,
					targetBlessing: 'listeners' in intent.target ? intent.target : undefined,
					requestedAmount: intent.amount,
					appliedAmount: intent.amount,
				},
			];
		case 'set_hp': {
			const previousHp = intent.target.hp;
			intent.target.hp = clamp(intent.nextHp, 0, intent.target.maxHp);
			intent.target.isDead = intent.target.hp <= 0;
			return [
				{
					id: createId('event'),
					phase: 'committed',
					kind: 'set_hp',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetEntity: intent.target,
					previousHp,
					nextHp: intent.target.hp,
				},
			];
		}
		case 'set_blessing_exhausted':
			intent.target.isExhausted = intent.isExhausted;
			return [
				{
					id: createId('event'),
					phase: 'committed',
					kind: 'set_blessing_exhausted',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetBlessing: intent.target,
					appliedAmount: intent.isExhausted ? 1 : 0,
				},
			];
		case 'set_attunement':
			intent.target.attunedTo[intent.element] = intent.value;
			intent.target.turnsAttuned[intent.element] = intent.value
				? Math.max(intent.target.turnsAttuned[intent.element], 1)
				: 0;
			return [
				{
					id: createId('event'),
					phase: 'committed',
					kind: 'set_attunement',
					sourceEntity: intent.sourceEntity,
					sourceMove: intent.sourceMove,
					sourceBlessing: intent.sourceBlessing,
					targetEntity: intent.target,
					element: intent.element,
					appliedAmount: intent.value ? 1 : 0,
				},
			];
	}
}

function resolveEventListeners(
	event: CombatEvent,
	phase: 'interrupt' | 'side_effect',
	ctx: StepResolutionContext,
	frame: ExecutionFrame,
): void {
	const matches = getMatchingListeners(ctx.combat, phase, event.kind, event);
	for (const match of matches) {
		const nextContext: StepResolutionContext = {
			...ctx,
			blessing: match.blessing,
			listenerOwner: match.owner,
			currentEvent: event,
		};
		applyBlessingEffects(match.listener.effects, nextContext, frame);
		if (frame.breakSequence && phase === 'interrupt') {
			return;
		}
	}
}

function drainSideEffects(
  ctx: StepResolutionContext,
  frame: ExecutionFrame
): void {
	while (frame.sideEffectQueue.length > 0) {
		if (frame.depth >= frame.maxDepth) {
			throw new Error(`Maximum combat resolution depth ${frame.maxDepth} exceeded.`);
		}
		const intent = frame.sideEffectQueue.shift();
		if (!intent) {
			continue;
		}
		const nestedContext: StepResolutionContext = {
			...ctx,
			move: intent.sourceMove,
			blessing: intent.sourceBlessing,
			caster: intent.sourceEntity ?? ctx.caster,
			currentIntent: intent,
		};
		frame.depth += 1;
		resolveIntent(intent, nestedContext, frame);
		frame.depth -= 1;
	}
}

export function createExecutionFrame(
	caster: CombatEntity,
	move: CombatMove | null,
	blessing: CombatBlessing | null = null,
	selectedEntities: Array<CombatEntity> = [],
): ExecutionFrame {
	return {
		id: createId('frame'),
		sourceEntity: caster,
		sourceMove: move,
		sourceBlessing: blessing,
		selectedEntities,
		stepIndex: 0,
		breakSequence: false,
		eventLog: [],
		sideEffectQueue: [],
		maxDepth: 50,
		depth: 0,
	};
}

export function resolveIntent(
	intent: CombatIntent,
	ctx: StepResolutionContext,
	frame: ExecutionFrame,
): Array<CombatEvent> {
	const events: Array<CombatEvent> = [];
	const attemptEvent = createAttemptEvent(intent);
	frame.eventLog.push(attemptEvent);
	events.push(attemptEvent);

	resolveEventListeners(attemptEvent, 'interrupt', {
		...ctx,
		currentEvent: attemptEvent,
		currentIntent: intent,
	}, frame);

	if (intent.cancelled) {
		return events;
	}

	const committedEvents = commitIntent(intent);
	for (const committedEvent of committedEvents) {
		frame.eventLog.push(committedEvent);
		events.push(committedEvent);
		resolveEventListeners(committedEvent, 'side_effect', {
			...ctx,
			currentEvent: committedEvent,
			currentIntent: intent,
		}, frame);
	}

	drainSideEffects(ctx, frame);
	return events;
}

function executeStep(
	step: OperationStep,
	ctx: StepResolutionContext,
	frame: ExecutionFrame,
): Array<CombatEvent> {
	const events: Array<CombatEvent> = [];

	switch (step.kind) {
		case 'break_sequence':
			frame.breakSequence = true;
			return events;
		case 'repeat': {
			const times = resolveNumericValue(step.times);
			for (let i = 0; i < times; i += 1) {
				for (const nestedStep of step.steps) {
					if (frame.breakSequence) {
						return events;
					}
					events.push(...executeStep(nestedStep, ctx, frame));
				}
			}
			return events;
		}
		case 'emit_intent': {
			const intent = resolveIntentDefinition(step.intent, ctx);
			events.push(...resolveIntent(intent, {
				...ctx,
				currentIntent: intent,
			}, frame));
			return events;
		}
	}
}

export function executeSteps(
	steps: Array<OperationStep>,
	ctx: StepResolutionContext,
	frame: ExecutionFrame,
): ResolutionResult {
	const events: Array<CombatEvent> = [];

	for (const step of steps) {
		if (frame.breakSequence) {
			break;
		}
		frame.stepIndex += 1;
		events.push(...executeStep(step, ctx, frame));
	}

	ctx.combat.eventLog.push(
		...events.map((event) => `${event.phase}:${event.kind}:${event.id}`),
	);

	return {
		frame,
		events,
		breaks: frame.breakSequence,
	};
}

export function executeMove(
	combat: CombatState,
	caster: CombatEntity,
	move: CombatMove,
	selectedEntities: Array<CombatEntity> = [],
): ResolutionResult {
	const frame = createExecutionFrame(caster, move, null, selectedEntities);
	return executeSteps(move.steps, {
		combat,
		caster,
		move,
		blessing: null,
		selectedEntities,
		selectedMoves: [],
		selectedBlessings: [],
	}, frame);
}
