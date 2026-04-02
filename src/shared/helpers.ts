// src/shared/helpers.ts

export function createRecord <T extends string, V> (
	keys: readonly T[],
	value: V,
): Record<T, V> {
	const record = {} as Record<T, V>;
	for (const key of keys) {
		record[key] = value;
	}
	return record;
}
