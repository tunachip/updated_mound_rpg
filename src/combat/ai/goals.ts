// src/combat/ai/goals.ts

import type { Goal } from '.';
import { CombatState } from '../types';
import type { CombatEntity } from '../models';
import { alliesOf, enemiesOf } from './helpers';
import { Statuses } from '../../shared';

export function createGoal(
	goal: string,
	entity: CombatEntity,
	target: CombatEntity,
	amount: number,
	weight: number,
): Goal {
	switch (goal) {
		case 'killEnemy':
			return ({
				id: 'killEnemy',
				name: `Kill Enemy ${target.name}`,
				goalType: 'approach',
				host: target,
				targetType: 'enemy',
				field: ['hp'],
				value: 0,
				weight: 1,
			});
		case 'maintainAllyHp':
			return ({
				id: 'healAlly',
				name: `Maintain ${target.name}.hp == ${amount}`,
				goalType: 'maintain',
				host: target,
				targetType: 'ally',
				field: ['hp'],
				value: amount,
				weight: 1,
			});
		case 'healSelf':
			return {
				id: 'healSelf',
				name: `Maintain ${entity.name}.hp == ${amount}`,
				goalType: 'maintain',
				host: entity,
				targetType: 'self',
				field: ['hp'],
				value: amount,
				weight: 1,
			}
		default:
			throw new Error('Invalid Goal Called');
	}
}

	export function createGoals(
		combat: CombatState,
		entity: CombatEntity,
	): Array<Goal> {
		const profile = entity.aiTuning;
		const goals: Array<Goal> = [];
		if (profile) {
			for (const enemy of enemiesOf(combat, entity)) {
				goals.push(createGoal('killEnemy', entity, enemy, 0));
			}
			if (profile.maintainsAllyHp.weight > 0) {
				const amount = profile.maintainsAllyHp.amount;
				for (const ally of alliesOf(combat, entity)) {
					goals.push(createGoal(
					  'maintainAllyHp',
					  entity,
					  ally,
					  profile.maintainsAllyHp.amount
					));
				}
			}
			if (profile.maintainsHp.weight > 0) {
				const amount = profile.maintainsHp.amount;
				goals.push(createGoal(
				  'maintainSelfHp',
				  entity,
				  entity,
				  profile.maintainsHp.amount
				));
			}
			if (profile.avoidsDeath.weight > 0) {
				goals.push({
					id: 'avoidDeath',
					name: `Prevent ${entity.name}.hp == 0`,
					goalType: 'prevent',
					host: entity,
					targetType: 'self',
					field: ['hp'],
					value: 0,
					weight: profile.avoidsDeath.weight,
				});
			}
			for (const status of Statuses) {
				if (profile.avoidsStatuses[status].weight > 0) {
					const weight = profile.avoidsStatuses[status].weight;
					const amount = profile.avoidsStatuses[status].amount;
					goals.push({
						id: 'avoidStatus',
						name: `Maintain ${entity.name}.hasStatus[${status}] < ${amount}`,
						goalType: 'maintain',
						host: entity,
						targetType: 'self',
						field: ['hasStatus', status],
						value: amount,
						weight: weight,
					});
				}
				if (profile.desiresStatuses[status].weight > 0) {
					const weight = profile.desiresStatuses[status].weight;
					const amount = profile.desiresStatuses[status].amount;
					goals.push({
						id: 'desireStatus',
						name: `Maintain ${entity.name}.hasStatus[${status}] >= ${amount}`,
						goalType: 'maintain',
						host: entity,
						targetType: 'self',
						field: ['hasStatus', status],
						value: amount,
						weight: weight,
					});
				}
				if (profile.appliesStatusesToEnemies[status].weight > 0) {
					for (const enemy of enemiesOf(combat, entity)) {
						const weight = profile.appliesStatusesToEnemies[status].weight;
						const amount = profile.appliesStatusesToEnemies[status].amount;
						goals.push({
							id: 'applyStatusToEnemy',
							name: `Approach ${enemy.name}.hasStatus[${status}] == ${amount}`,
							goalType: 'approach',
							host: enemy,
							targetType: 'enemy',
							field: ['hasStatus', status],
							value: amount,
							weight: weight,
						});
					}
					if (profile.appliesStatusesToAllies[status].weight > 0) {
						for (const ally of alliesOf(combat, entity)) {
							const weight = profile.appliesStatusesToAllies[status].weight;
							const amount = profile.appliesStatusesToAllies[status].amount;
							goals.push({
								id: 'applyStatusToAlly',
								name: `Approach ${ally.name}.hasStatus[${status}] == ${amount}`,
								goalType: 'approach',
								host: ally,
								targetType: 'ally',
								field: ['hasStatus', status],
								value: amount,
								weight: weight,
							});
						}
					}
				}
			}
		}
		return goals;
	}


