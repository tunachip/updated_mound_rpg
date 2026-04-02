declare module 'node:readline' {
	export interface Key {
		name?: string;
		ctrl?: boolean;
	}

	export function emitKeypressEvents(stream: unknown): void;
}
