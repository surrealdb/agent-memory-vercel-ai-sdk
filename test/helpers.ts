import type { AgentMemory } from '@surrealdb/memory';
import { vi } from 'vitest';

/**
 * A minimal fake Agent Memory client for tests. Only the methods the middleware and
 * tools touch are implemented; each is a `vi.fn()` with a sensible default that
 * individual tests can override with `mockResolvedValueOnce`.
 */
export function createFakeClient(
	overrides: Partial<Record<keyof AgentMemory, unknown>> = {},
) {
	const client = {
		context: vi.fn(async () => ({
			context: 'CONTEXT_TEXT',
			queryMs: 1,
			tier: 'tier1',
		})),
		recall: vi.fn(async () => ({
			hits: [
				{ id: 'a', text: 'recall one', score: 0.9, source: 'fact' },
				{ id: 'b', text: 'recall two', score: 0.8, source: 'passage' },
			],
			classificationKind: 'hybrid',
			queryMs: 1,
			seedEntities: [],
			tier: 'tier1',
			trace: {},
		})),
		profile: vi.fn(async () => ({
			static: [{ key: 'name', value: 'Tobie' }],
			dynamic: [],
			preferences: [{ key: 'theme', value: 'dark' }],
			instructions: [
				{ id: 'i1', label: 'tone', description: 'Be concise.' },
			],
		})),
		rememberMany: vi.fn(async () => ({
			extractions: [],
			sessionId: 'sess-1',
			turnIds: ['t1', 't2'],
		})),
		remember: vi.fn(async () => ({
			mode: 'full',
			sessionId: 'sess-1',
			turnId: 't1',
		})),
		reflect: vi.fn(async () => ({
			reflection: 'REFLECTION',
			evidence: ['e1'],
			persistedAttributes: [],
			traceId: 'tr1',
		})),
		forget: vi.fn(async () => ({ deleted: 3 })),
		inspect: vi.fn(async () => ({ kind: 'entity', entity: { id: 'x' } })),
		...overrides,
	};
	return client as unknown as AgentMemory & typeof client;
}

/** Builds a ReadableStream that emits the given parts and closes. */
export function streamOf<T>(parts: T[]): ReadableStream<T> {
	return new ReadableStream<T>({
		start(controller) {
			for (const part of parts) {
				controller.enqueue(part);
			}
			controller.close();
		},
	});
}

/** Reads a ReadableStream to completion, returning all emitted chunks. */
export async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
	const reader = stream.getReader();
	const out: T[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		out.push(value);
	}
	return out;
}
