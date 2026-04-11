// src/combat/ai/parallel-worker.ts

import { parentPort, workerData } from 'node:worker_threads';
import { analyzeTurnChoicesForEntities } from './turnChoice.ts';
import type { PlanningWorkerRequest, PlanningWorkerResult } from './parallel-types.ts';
import { hydrateCombatPlanningState, serializeTurnChoice } from './snapshot.ts';

const port = parentPort;
if (!port) {
	throw new Error('Parallel AI worker requires a parent port.');
}

const job = workerData as PlanningWorkerRequest;
const startedAt = Date.now();
const combat = hydrateCombatPlanningState(job.snapshot);
const entityLookup = new Map([
	...combat.entities.party,
	...combat.entities.encounters].map(
		(entity) => [entity.id, entity] as const
	),
);

const entities = job.entityIds.map(
	(entityId) => entityLookup.get(entityId)
).filter((entity) => entity != null);

const choicesByEntityId = Object.fromEntries([
	...analyzeTurnChoicesForEntities(combat, entities).entries()
].map(
	([entityId, analyses]) => [
		entityId,
		analyses.map(({ choice }) => serializeTurnChoice(choice)),
	]),
);

const result: PlanningWorkerResult = {
	elapsedMs: Date.now() - startedAt,
	choicesByEntityId,
};

port.postMessage(result);
