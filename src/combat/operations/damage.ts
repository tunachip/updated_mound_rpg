// src/combat/operations/damage.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import type { CombatEntity } from '../models';
import type { DamageElement } from '../../shared';
import { DamageElements, ElementRelationships } from '../../shared';
import { requireCtx } from './helpers.ts';

interface CalculatedDamage {
	damage: number;
	healed: number;
	blocked: boolean;
}

function calculateDamage(
	baseDamage: number,
	element: DamageElement,
	target: CombatEntity,
): CalculatedDamage {
	const calculated: CalculatedDamage = {
		damage: baseDamage,
		healed: 0,
		blocked: false,
	};

	for (const attunement of DamageElements) {
		if (target.attunedTo[attunement] !== true) {
			continue;
		}
		switch (ElementRelationships[element][attunement]) {
			case 'weak':
				calculated.damage += 1;
				break;
			case 'resists':
				calculated.damage -= 1;
				break;
			case 'absorbs':
				calculated.healed += 1;
				break;
			case 'blocked':
				calculated.blocked = true;
				break;
		}
	}
	return calculated;
}

function getStatusDamageElement(
	status: NonNullable<OperationContext['status']>
): DamageElement | null {
	switch (status) {
		case 'burn': return 'fire';
		case 'decay': return 'force';
		case 'wound': return 'vital';
		default: return null;
	}
}

function createHpChange(
	target: CombatEntity,
	calculated: CalculatedDamage
): StateChange | null {
	if (calculated.healed > 0) {
		const before = target.hp;
		const after = Math.min(target.maxHp, before + calculated.healed);
		if (after > before) {
			return {
				host: target,
				field: ['hp'],
				before: before,
				after: after,
			};
		}
		else {
			return null;
		}
	}
	if (calculated.blocked) {
		return null;
	}
	const before = target.hp;
	const after = Math.max(0, before - calculated.damage);
	if (after < before) {
		return {
			host: target,
			field: ['hp'],
			before: before,
			after: after,
		};
	}
	else {
		return null;
	}
}

export function attack(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('attack', ctx, ['element', 'amount']);
	const { element, amount } = ctx;

	for (const target of ctx.targets.entities) {
		const calculated = calculateDamage(amount, element, target);
		const intent = createHpChange(target, calculated);
		if (intent) intents.push(intent);
	}
	return intents;
}

export function applyDamageFromStatus(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('applyDamageFromStatus', ctx, ['status', 'amount']);
	const { status, amount } = ctx;

	const element = getStatusDamageElement(status);
	if (!element) return intents;

	for (const target of ctx.targets.entities) {
		const calculated = calculateDamage(amount, element, target);
		const intent = createHpChange(target, calculated);
		if (intent) intents.push(intent);
	}
	return intents;
}
