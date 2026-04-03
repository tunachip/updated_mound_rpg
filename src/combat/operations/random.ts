// src/combat/operations/random.ts

export function randomIndex(
	length: number,
): number {
	if (length <= 0) {
		throw new Error('randomIndex requires a positive length.');
	}
	return Math.floor(Math.random() * length);
}
