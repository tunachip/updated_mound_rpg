// src/combat/operations/loop.ts

import type { StateChange } from './diff.ts';
import type { Operation, OperationContext } from '.';
import { mergeStateChanges } from './diff.ts';
import { executeOperation, previewOperations } from './resolver.ts';

export function loop(
	ctx: OperationContext
): Array<StateChange> {
	const operations = ctx.operations ?? ctx.move?.loopOperations ?? [];
	if (operations.length === 0) {
		return [];
	}

	const totalIterations = 
		(ctx.move?.baseIterations ?? 1) +
		ctx.caster.extraIterations;
	
	const times = Math.max(0, totalIterations);
	if (times === 0) {
		return [];
	}

	const expandedOperations: Array<Operation> = [];
	for (let i = 0; i < times; i += 1) {
		expandedOperations.push(...operations);
	}

	if (ctx.predictionMode === 'preview') {
		const previewSequence = previewOperations(expandedOperations, ctx);
		return previewSequence[previewSequence.length - 1] ?? [];
	}

	const changes: Array<StateChange> = [];
	for (const operation of expandedOperations) {
		const result = executeOperation(operation, {
			...ctx,
			changes: mergeStateChanges([
				...(ctx.changes ?? []),
				...changes,
			]),
		});
		changes.push(...result.changes);
		if (result.breaks) {
			break;
		}
	}

	return mergeStateChanges(changes);
}
