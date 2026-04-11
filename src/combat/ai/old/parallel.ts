// src/combat/ai/parallel.ts

import { Worker } from 'node:worker_threads';

import type { TurnChoice } from '../models';
import type { CombatState } from '../types.ts';
import type { PlanningWorkerRequest, PlanningWorkerResult } from './parallel-types.ts';
import { hydrateSerializedTurnChoice, serializeCombatPlanningState } from './snapshot.ts';

export interface ParallelPlanningSummary {
	workerCount: number;
	totalElapsedMs: number;
	workerElapsedMs: Array<number>;
}

function spawnPlanningWorker(
	job: PlanningWorkerRequest,
): Promise<PlanningWorkerResult> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(
			new URL('./parallel-worker.ts', import.meta.url),
			{
				workerData: job,
				execArgv: [...new Set([
					...process.execArgv.filter(
						(arg) => arg !== '--input-type=module'
					),
					'--no-warnings',
					'--experimental-strip-types',
				])],
			},
		);

		worker.once('message', (result: PlanningWorkerResult) => {
			resolve(result);
		});
		worker.once('error', reject);
		worker.once('exit', (code) => {
			if (code !== 0) {
				reject(new Error(`AI worker exited with code ${code}.`));
			}
		});
	});
}

export async function calculateAllTurnChoicesInWorkers(
	combat: CombatState,
): Promise<Map<string, Array<TurnChoice>>> {
	return (await calculateAllTurnChoicesInWorkersDetailed(combat)).choicesByEntityId;
}

export async function calculateAllTurnChoicesInWorkersDetailed(
	combat: CombatState,
): Promise<{
	choicesByEntityId: Map<string, Array<TurnChoice>>;
	summary: ParallelPlanningSummary;
}> {
	const snapshot = serializeCombatPlanningState(combat);
	const jobs: Array<PlanningWorkerRequest> = [];

	const partyIds = combat.entities.party
		.filter((entity) => entity.isDead === false)
		.map((entity) => entity.id);
	if (partyIds.length > 0) {
		jobs.push({
			snapshot,
			entityIds: partyIds,
		});
	}

	const encounterIds = combat.entities.encounters
		.filter((entity) => entity.isDead === false)
		.map((entity) => entity.id);
	if (encounterIds.length > 0) {
		jobs.push({
			snapshot,
			entityIds: encounterIds,
		});
	}

	const startedAt = Date.now();
	const results = await Promise.all(jobs.map(spawnPlanningWorker));
	const choicesByEntityId = new Map<string, Array<TurnChoice>>();

	for (const result of results) {
		for (const [entityId, serializedChoices] of Object.entries(result.choicesByEntityId)) {
			choicesByEntityId.set(
				entityId,
				serializedChoices.map((choice) =>
					hydrateSerializedTurnChoice(combat, entityId, choice),
				),
			);
		}
	}

	return {
		choicesByEntityId,
		summary: {
			workerCount: jobs.length,
			totalElapsedMs: Date.now() - startedAt,
			workerElapsedMs: results.map((result) => result.elapsedMs),
		},
	};
}
