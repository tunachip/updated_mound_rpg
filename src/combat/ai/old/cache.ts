// src/combat/ai/cache.ts

import type { TurnChoice } from '../models';
import type { StateChange } from '../operations';
import type { CombatTeam } from '../../shared';
import { CombatTeams } from '../../shared';

export interface ProjectedChoice {
	choice: TurnChoice;
	immediateChanges: Array<StateChange>;
	bias: number;
}

export interface StateChoiceCatalog {
	signature: string;
	actorChoices: Map<string, Array<ProjectedChoice>>;
}

export interface BranchPrediction {
	changes: Array<StateChange>;
	utility: number;
}

export interface AiPredictionCache {
	currentSignature: string;
	catalogs: Record<CombatTeam, Map<string, StateChoiceCatalog>>;
	branches: Record<CombatTeam, Map<string, Map<string, BranchPrediction>>>;
	children: Map<string, Set<string>>;
}

export function createAiPredictionCache(
	currentSignature: string,
): AiPredictionCache {
	return {
		currentSignature,
		catalogs: {
			party: new Map(),
			encounters: new Map(),
		},
		branches: {
			party: new Map(),
			encounters: new Map(),
		},
		children: new Map(),
	};
}

export function markAiPredictionCacheDirty(
	host: { aiCache: AiPredictionCache | null | undefined },
): void {
	if (!host.aiCache) {
		return;
	}
	host.aiCache.currentSignature = '';
}

export function setAiPredictionCacheRoot(
	cache: AiPredictionCache,
	currentSignature: string,
): void {
	cache.currentSignature = currentSignature;
}

export function recordAiPredictionChild(
	cache: AiPredictionCache,
	parentSignature: string,
	childSignature: string,
): void {
	if (parentSignature === childSignature) {
		return;
	}

	const existing = cache.children.get(parentSignature) ?? new Set<string>();
	existing.add(childSignature);
	cache.children.set(parentSignature, existing);
}

function collectReachableStateSignatures(
	cache: AiPredictionCache,
	rootSignature: string,
): Set<string> {
	const reachable = new Set<string>();
	const pending = [rootSignature];

	while (pending.length > 0) {
		const signature = pending.pop();
		if (!signature || reachable.has(signature)) {
			continue;
		}
		reachable.add(signature);

		const childSignatures = cache.children.get(signature) ?? [];
		for (const signature of childSignatures) {
			if (!reachable.has(signature)) {
				pending.push(signature);
			}
		}
	}
	return reachable;
}

export function pruneAiPredictionCache(
	cache: AiPredictionCache,
	rootSignature: string,
): void {
	if (!rootSignature) {
		return;
	}
	const reachable = collectReachableStateSignatures(cache, rootSignature);
	reachable.add(rootSignature);

	for (const team of CombatTeams) {
		for (const signature of [...cache.catalogs[team].keys()]) {
			if (!reachable.has(signature)) {
				cache.catalogs[team].delete(signature);
			}
		}
		for (const signature of [...cache.branches[team].keys()]) {
			if (!reachable.has(signature)) {
				cache.branches[team].delete(signature);
			}
		}
	}
	for (const signature of [...cache.children.keys()]) {
		if (!reachable.has(signature)) {
			cache.children.delete(signature);
			continue;
		}
		const children = cache.children.get(signature);
		if (!children) {
			continue;
		}
		for (const childSignature of [...children]) {
			if (!reachable.has(childSignature)) {
				children.delete(childSignature);
			}
		}
		cache.children.set(signature, children);
	}
}
