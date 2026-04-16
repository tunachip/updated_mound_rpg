// src/combat/operations/goal.ts

import type { Goal } from '../ai/types.ts';
import type { StateChange } from './diff.ts';
import type { OperationContext } from './types.ts';
import { requireCtx } from './helpers.ts';

function sameField(
	left: Array<string>,
	right: Array<string>,
): boolean {
	return left.length === right.length &&
		left.every((segment, index) => segment === right[index]);
}

function matchesGoal(
	goal: Goal,
	ctx: OperationContext,
): boolean {
	if (ctx.goalId && goal.id !== ctx.goalId) {
		return false;
	}
	if (ctx.goalKind && goal.kind !== ctx.goalKind) {
		return false;
	}
	if (ctx.goalField && !sameField(goal.field, ctx.goalField)) {
		return false;
	}
	if (ctx.goalValue !== undefined && !Object.is(goal.value, ctx.goalValue)) {
		return false;
	}

	return (
		ctx.goalId != null ||
		ctx.goalKind != null ||
		ctx.goalField != null ||
		ctx.goalValue !== undefined
	);
}

export function adjustGoalWeight(
	ctx: OperationContext,
): Array<StateChange> {
	requireCtx('adjustGoalWeight', ctx, ['amount']);

	const intents: Array<StateChange> = [];
	for (const target of ctx.targets.entities) {
		target.goals.forEach((goal, index) => {
			if (!matchesGoal(goal, ctx)) {
				return;
			}
			intents.push({
				host: target,
				field: ['goals', String(index), 'weight'],
				before: goal.weight,
				after: goal.weight + ctx.amount,
				signal: `goal.weight.changed.${goal.id}`,
			});
		});
	}
	return intents;
}

export function setGoalWeight(
	ctx: OperationContext,
): Array<StateChange> {
	requireCtx('setGoalWeight', ctx, ['amount']);

	const intents: Array<StateChange> = [];
	for (const target of ctx.targets.entities) {
		target.goals.forEach((goal, index) => {
			if (!matchesGoal(goal, ctx)) {
				return;
			}
			intents.push({
				host: target,
				field: ['goals', String(index), 'weight'],
				before: goal.weight,
				after: ctx.amount,
				signal: `goal.weight.changed.${goal.id}`,
			});
		});
	}
	return intents;
}
