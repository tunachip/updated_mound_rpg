// src/combat/operations/helpers.ts

import type { OperationContext } from './types.ts';

export function randomNumber (
	min: number,
	max: number
): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

export function requireCtx <K extends keyof OperationContext> (
	operation: string,
	ctx: OperationContext,
	keys: readonly K[],
): asserts ctx is OperationContext & Required<Pick<OperationContext, K>> {
	const missing = keys.filter((key) => ctx[key] == null);

	if (missing.length > 0) {
		let errorMessage = `'${operation}' Failed.\n\nMissing CTX Attributes:\n`;
		for (const key of missing) {
			errorMessage += `\t'${String(key)}'\n`;
		}
		throw new Error(errorMessage);
	}
}
