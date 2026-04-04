// src/combat/operations/open-wounds.ts

import type { DamageElement } from '../../shared';
import type { StateChange } from './diff.ts';
import type { CombatEntity } from '../models';
import type { OperationContext } from './types.ts';
import { DamageElements, ElementRelationships } from '../../shared/index.ts';

function sameField(
	left: Array<string>,
	right: Array<string>,
): boolean {
	return left.length === right.length &&
		left.every((segment, index) => segment === right[index]);
}

function readCurrentValue(
	host: Record<string, unknown>,
	field: Array<string>,
): unknown {
	let current: unknown = host;
	for (const segment of field) {
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function getProjectedValue<T>(
	target: CombatEntity,
	field: Array<string>,
	changes: Array<StateChange>,
): T {
	for (let i = changes.length - 1; i >= 0; i -= 1) {
		const change = changes[i];
		if (change.host !== target) {
			continue;
		}
		if (sameField(change.field, field)) {
			return change.after as T;
		}
	}
	return readCurrentValue(target as unknown as Record<string, unknown>, field) as T;
}

function calculateDamage(
	baseDamage: number,
	element: DamageElement,
	target: CombatEntity,
): {
	damage: number;
	healed: number;
	blocked: boolean;
} {
	const calculated = {
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

export function openWounds(
	ctx: OperationContext
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const changes = ctx.changes ?? [];

	for (const target of ctx.targets.entities) {
		const becameBloody =
			target.isBloody === false &&
			getProjectedValue<boolean>(target, ['isBloody'], changes) === true;
		if (!becameBloody) {
			continue;
		}

		const wounds = getProjectedValue<number>(target, ['statusTurns', 'wound'], changes);
		const amount = ctx.amount == null
			? wounds
			: Math.min(ctx.amount, wounds);
		if (amount <= 0) {
			continue;
		}

		let hp = getProjectedValue<number>(target, ['hp'], changes);
		let lastDamageTaken = getProjectedValue<number>(target, ['lastDamageTaken'], changes);
		let totalDamageTaken = getProjectedValue<number>(target, ['totalDamageTaken'], changes);
		let maxDamageTaken = getProjectedValue<number>(target, ['maxDamageTaken'], changes);
		let isDead = getProjectedValue<boolean>(target, ['isDead'], changes);

		for (let i = 0; i < amount && !isDead; i += 1) {
			const calculated = calculateDamage(1, 'vital', target);
			if (calculated.blocked) {
				continue;
			}

			if (calculated.healed > 0) {
				const before = hp;
				const after = Math.min(target.maxHp, before + calculated.healed);
				if (after > before) {
					intents.push({
						host: target,
						field: ['hp'],
						before,
						after,
					});
					hp = after;
				}
				continue;
			}

			const before = hp;
			const after = Math.max(0, before - calculated.damage);
			const damageTaken = before - after;
			if (damageTaken <= 0) {
				continue;
			}

			intents.push({
				host: target,
				field: ['hp'],
				before,
				after,
			});

			intents.push({
				host: target,
				field: ['lastDamageTaken'],
				before: lastDamageTaken,
				after: damageTaken,
			});
			lastDamageTaken = damageTaken;

			intents.push({
				host: target,
				field: ['totalDamageTaken'],
				before: totalDamageTaken,
				after: totalDamageTaken + damageTaken,
			});
			totalDamageTaken += damageTaken;

			if (damageTaken > maxDamageTaken) {
				intents.push({
					host: target,
					field: ['maxDamageTaken'],
					before: maxDamageTaken,
					after: damageTaken,
				});
				maxDamageTaken = damageTaken;
			}

			if (!isDead && after === 0) {
				intents.push({
					host: target,
					field: ['isDead'],
					before: false,
					after: true,
				});
				isDead = true;
			}

			hp = after;
		}
	}
	return intents;
}
