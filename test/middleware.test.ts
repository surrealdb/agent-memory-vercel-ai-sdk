import { describe, expect, it, vi } from 'vitest';
import { buildMiddleware } from '../src/middleware';
import { createFakeClient, drain, streamOf } from './helpers';

// Minimal params/model stand-ins; the middleware only reads `params.prompt`.
function paramsWith(userText: string) {
	return {
		prompt: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
	} as never;
}
const model = {} as never;

describe('transformParams', () => {
	it('injects a system message with context and profile', async () => {
		const client = createFakeClient();
		const mw = buildMiddleware(client, { scopes: 'user/tobie' });

		const out = (await mw.transformParams?.({
			type: 'generate',
			params: paramsWith('what do you know about me?'),
			model,
		})) as { prompt: Array<{ role: string; content: string }> };

		expect(client.context).toHaveBeenCalledWith(
			'what do you know about me?',
			{
				k: 8,
				lens: 'user/tobie',
			},
		);
		expect(out.prompt[0]?.role).toBe('system');
		expect(out.prompt[0]?.content).toContain('CONTEXT_TEXT');
		expect(out.prompt[0]?.content).toContain('name: Tobie');
		expect(out.prompt[0]?.content).toContain('Be concise.');
	});

	it('uses recall when retrieval is "recall"', async () => {
		const client = createFakeClient();
		const mw = buildMiddleware(client, {
			retrieval: 'recall',
			includeProfile: false,
		});

		const out = (await mw.transformParams?.({
			type: 'generate',
			params: paramsWith('where do I live?'),
			model,
		})) as { prompt: Array<{ role: string; content: string }> };

		expect(client.recall).toHaveBeenCalled();
		expect(client.context).not.toHaveBeenCalled();
		expect(out.prompt[0]?.content).toContain('recall one');
	});

	it('is a no-op when injectHistory and includeProfile are both off', async () => {
		const client = createFakeClient();
		const mw = buildMiddleware(client, {
			injectHistory: false,
			includeProfile: false,
		});
		const params = paramsWith('hi');

		const out = await mw.transformParams?.({
			type: 'generate',
			params,
			model,
		});

		expect(out).toBe(params);
		expect(client.context).not.toHaveBeenCalled();
		expect(client.profile).not.toHaveBeenCalled();
	});

	it('fails open: returns original params and calls onError when retrieval throws', async () => {
		const onError = vi.fn();
		const client = createFakeClient({
			context: vi.fn(async () => {
				throw new Error('spectron down');
			}),
		});
		const mw = buildMiddleware(client, { onError });
		const params = paramsWith('hello');

		const out = await mw.transformParams?.({
			type: 'generate',
			params,
			model,
		});

		expect(out).toBe(params);
		expect(onError).toHaveBeenCalledOnce();
	});
});

describe('wrapGenerate', () => {
	it('stores the user query and assistant reply', async () => {
		const client = createFakeClient();
		const mw = buildMiddleware(client, {
			scopes: 'user/tobie',
			sessionId: 'sess-1',
		});

		const result = await mw.wrapGenerate?.({
			doGenerate: async () =>
				({
					content: [{ type: 'text', text: 'the reply' }],
					finishReason: { type: 'stop' },
					usage: {},
				}) as never,
			doStream: async () => ({ stream: streamOf([]) }) as never,
			params: paramsWith('the question'),
			model,
		});

		expect((result as { content: unknown[] }).content).toBeDefined();
		expect(client.rememberMany).toHaveBeenCalledWith(
			[
				{ role: 'user', content: 'the question' },
				{ role: 'assistant', content: 'the reply' },
			],
			{ sessionId: 'sess-1', scopes: 'user/tobie' },
		);
	});

	it('does not store when store is false', async () => {
		const client = createFakeClient();
		const mw = buildMiddleware(client, { store: false });

		await mw.wrapGenerate?.({
			doGenerate: async () =>
				({
					content: [{ type: 'text', text: 'x' }],
					finishReason: { type: 'stop' },
					usage: {},
				}) as never,
			doStream: async () => ({ stream: streamOf([]) }) as never,
			params: paramsWith('q'),
			model,
		});

		expect(client.rememberMany).not.toHaveBeenCalled();
	});
});

describe('wrapStream', () => {
	it('passes chunks through and stores the accumulated reply on flush', async () => {
		const client = createFakeClient();
		const mw = buildMiddleware(client, { sessionId: 'sess-1' });

		const parts = [
			{ type: 'text-start', id: '1' },
			{ type: 'text-delta', id: '1', delta: 'Hel' },
			{ type: 'text-delta', id: '1', delta: 'lo!' },
			{ type: 'text-end', id: '1' },
		];

		const wrapped = (await mw.wrapStream?.({
			doStream: async () => ({ stream: streamOf(parts) }) as never,
			doGenerate: async () => ({}) as never,
			params: paramsWith('greet me'),
			model,
		})) as { stream: ReadableStream<unknown> };

		const emitted = await drain(wrapped.stream);
		expect(emitted).toEqual(parts); // pass-through preserved

		await vi.waitFor(() =>
			expect(client.rememberMany).toHaveBeenCalledWith(
				[
					{ role: 'user', content: 'greet me' },
					{ role: 'assistant', content: 'Hello!' },
				],
				{ sessionId: 'sess-1', scopes: undefined },
			),
		);
	});
});
