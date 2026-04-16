// src/combat/operations/damage.ts

import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import type { CombatEntity } from '../models';
import type { DamageElement } from '../../shared';
import { DamageElements, ElementRelationships } from '../../shared/index.ts';
import { randomNumber, requireCtx } from './helpers.ts';
import { openWounds } from './open-wounds.ts';

interface CalculatedDamage {
	damage: number;
	healed: number;
	blocked: boolean;
}

function attackHitChance(
	target: CombatEntity,
): number {
	return Math.max(0, Math.min(1, 1 - (target.statusTurns.slick * 0.1)));
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
	calculated: CalculatedDamage,
	hitChance: number = 1,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	if (calculated.healed > 0) {
		const before = target.hp;
		const healed = calculated.healed * hitChance;
		const after = Math.min(target.maxHp, before + healed);
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
	const damage = calculated.damage * hitChance;
	const after = Math.max(0, before - damage);
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
		const hitChance = attackHitChance(target);
		if (
			ctx.predictionMode !== 'preview' &&
			hitChance < 1 &&
			randomNumber(0, 10) >= hitChance * 10
		) {
			intents.push({
				host: target,
				field: ['dodges'],
				before: target.dodges,
				after: target.dodges + 1,
				signal: 'entity.dodges',
			});
			continue;
		}

		const calculated = calculateDamage(amount, element, target);
		intents.push(...createHpChanges(
			target,
			calculated,
			ctx.predictionMode === 'preview' ? hitChance : 1,
		));
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
