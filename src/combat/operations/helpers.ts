// src/combat/operations/helpers.ts

import type {
	BlessingSelector,
	CasterSelector,
	ConstantValue,
	EntitySelector,
	EventStatusIsCondition,
	EventTargetIsOwnerCondition,
	NumericValue,
	SelectedEntitySelector,
	SelfBlessingSelector,
	WouldReduceTargetHpToOrBelowCondition,
} from './types.ts';
import type { Status } from '../../shared';

export function constant(value: number): ConstantValue {
	return { kind: 'constant', value };
}

export function caster(): CasterSelector {
	return { kind: 'caster' };
}

export function selectedEntity(index: number): SelectedEntitySelector {
	return { kind: 'selected_entity', index };
}

export function selfBlessing(): SelfBlessingSelector {
	return { kind: 'self_blessing' };
}

export function eventTargetIsOwner(): EventTargetIsOwnerCondition {
	return { kind: 'event_target_is_owner' };
}

export function eventStatusIs(status: Status): EventStatusIsCondition {
	return { kind: 'event_status_is', status };
}

export function wouldReduceTargetHpToOrBelow(
	threshold: number,
): WouldReduceTargetHpToOrBelowCondition {
	return { kind: 'event_would_reduce_target_hp_to_or_below', threshold };
}

export function resolveNumericValue(value: NumericValue): number {
	return value.value;
}

export function isEntitySelector(value: EntitySelector | BlessingSelector): value is EntitySelector {
	return value.kind !== 'self_blessing';
}


export function randomNumber (
	min: number,
	max: number
): number {
    return Math.floor(Math.random() * (max - min)) + min;
}
