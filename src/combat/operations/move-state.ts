import type { StateChange } from './diff.ts';
import type { OperationContext } from '.';
import { DamageElements, Statuses } from '../../shared/index.ts';
import { requireCtx } from './helpers.ts';

function setBankedState(
	target: { isBanked: boolean },
	next: boolean,
): StateChange | null {
	if (target.isBanked === next) {
		return null;
	}
	return {
		host: target as StateChange['host'],
		field: ['isBanked'],
		before: target.isBanked,
		after: next,
	};
}

export function bankMoves(
	ctx: OperationContext,
): Array<StateChange> {
	return ctx.targets.moves
		.map((target) => setBankedState(target, true))
		.filter((change): change is StateChange => change != null);
}

export function unbankMoves(
	ctx: OperationContext,
): Array<StateChange> {
	return ctx.targets.moves
		.map((target) => setBankedState(target, false))
		.filter((change): change is StateChange => change != null);
}

export function negatePreferredStatus(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	const preferredStatuses = [
		'anger',
		'sleep',
		'stun',
		'burn',
		'decay',
		'wound',
		'curse',
		'sick',
		'regen',
		'focus',
		'strong',
		'tough',
		'slick',
		'barbs',
	] as const;

	for (const target of ctx.targets.entities) {
		const status = preferredStatuses.find(
			(candidate) => target.hasStatus[candidate] === true,
		) ?? Statuses.find(
			(candidate) => target.hasStatus[candidate] === true,
		);
		if (!status) {
			continue;
		}

		intents.push({
			host: target,
			field: ['hasStatus', status],
			before: true,
			after: false,
		});
		intents.push({
			host: target,
			field: ['statusTurns', status],
			before: target.statusTurns[status],
			after: 0,
		});
	}

	return intents;
}

export function negatePreferredAttunementAndGrantEnergy(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];

	for (const target of ctx.targets.entities) {
		const attunement = [
			'thunder',
			...DamageElements.filter((element) => element !== 'thunder'),
		].find((element) => target.attunedTo[element] === true);
		if (!attunement) {
			continue;
		}

		intents.push({
			host: target,
			field: ['attunedTo', attunement],
			before: true,
			after: false,
		});

		if (target.energy < target.maxEnergy) {
			intents.push({
				host: target,
				field: ['energy'],
				before: target.energy,
				after: Math.min(target.maxEnergy, target.energy + 1),
			});
		}
	}

	return intents;
}

export function payEnergyForAdditionalStatusTurn(
	ctx: OperationContext,
): Array<StateChange> {
	const intents: Array<StateChange> = [];
	requireCtx('payEnergyForAdditionalStatusTurn', ctx, ['status', 'amount']);
	if (ctx.caster.energy < ctx.amount) {
		return intents;
	}

	intents.push({
		host: ctx.caster,
		field: ['energy'],
		before: ctx.caster.energy,
		after: Math.max(0, ctx.caster.energy - ctx.amount),
	});

	for (const target of ctx.targets.entities) {
		const before = target.statusTurns[ctx.status];
		const after = Math.min(target.statusMaxTurns[ctx.status], before + 1);
		if (after !== before) {
			intents.push({
				host: target,
				field: ['statusTurns', ctx.status],
				before,
				after,
			});
		}
		if (target.hasStatus[ctx.status] === false) {
			intents.push({
				host: target,
				field: ['hasStatus', ctx.status],
				before: false,
				after: true,
			});
		}
	}

	return intents;
}
