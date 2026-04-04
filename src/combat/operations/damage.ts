// src/combat/operations/damage.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import type { CombatEntity } from '../models';
import type { DamageElement } from '../../shared';
import { DamageElements, ElementRelationships } from '../../shared/index.ts';
import { requireCtx } from './helpers.ts';
import { openWounds } from './open-wounds.ts';

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
			case 'blocks':
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

function createHpChanges(
	target: CombatEntity,
	calculated: CalculatedDamage
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	if (calculated.healed > 0) {
		const before = target.hp;
		const after = Math.min(target.maxHp, before + calculated.healed);
		if (after > before) {
			intents.push({
				host: target,
				field: ['hp'],
				before: before,
				after: after,
			});
		}
		return intents;
	}
	if (calculated.blocked) {
		return intents;
	}

	const before = target.hp;
	const after = Math.max(0, before - calculated.damage);
	const damageTaken = before - after;
	if (damageTaken <= 0) {
		return intents;
	}

	intents.push({
		host: target,
		field: ['hp'],
		before: before,
		after: after,
	});
	intents.push({
		host: target,
		field: ['lastDamageTaken'],
		before: target.lastDamageTaken,
		after: damageTaken,
	});
	intents.push({
		host: target,
		field: ['totalDamageTaken'],
		before: target.totalDamageTaken,
		after: target.totalDamageTaken + damageTaken,
	});
	if (damageTaken > target.maxDamageTaken) {
		intents.push({
			host: target,
			field: ['maxDamageTaken'],
			before: target.maxDamageTaken,
			after: damageTaken,
		});
	}
	if (!target.isBloody && after <= Math.floor(target.maxHp / 2)) {
		intents.push({
			host: target,
			field: ['isBloody'],
			before: false,
			after: true,
		});
	}
	if (!target.isDead && after === 0) {
		intents.push({
			host: target,
			field: ['isDead'],
			before: false,
			after: true,
		});
	}

	return intents;
}

function appendOpenWounds(
	intents: Array<StateChange>,
	ctx: OperationContext,
	target: CombatEntity,
): void {
	if (target.isBloody || target.statusTurns.wound <= 0) {
		return;
	}

	intents.push(...openWounds({
		...ctx,
		targets: {
			entities: [target],
			moves: [],
			blessings: [],
		},
		changes: [
			...(ctx.changes ?? []),
			...intents,
		],
	}));
}

export function attack(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('attack', ctx, ['element', 'amount']);
	const { element, amount } = ctx;

	for (const target of ctx.targets.entities) {
		const calculated = calculateDamage(amount, element, target);
		intents.push(...createHpChanges(target, calculated));
		appendOpenWounds(intents, ctx, target);
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
		intents.push(...createHpChanges(target, calculated));
		appendOpenWounds(intents, ctx, target);
	}
	return intents;
}
