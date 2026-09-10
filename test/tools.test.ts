import { describe, expect, it } from 'vitest';
import { buildTools } from '../src/tools';
import { createFakeClient } from './helpers';

const execOpts = { toolCallId: '1', messages: [] } as never;

describe('buildTools', () => {
	it('exposes the expected tool set', () => {
		const tools = buildTools(createFakeClient());
		expect(Object.keys(tools).sort()).toEqual([
			'agent_memory_context',
			'agent_memory_forget',
			'agent_memory_inspect',
			'agent_memory_profile',
			'agent_memory_recall',
			'agent_memory_reflect',
			'agent_memory_remember',
		]);
	});

	it('agent_memory_recall maps hits and binds scope + session', async () => {
		const client = createFakeClient();
		const tools = buildTools(client, {
			scopes: 'user/tobie',
			sessionId: 's1',
		});

		const out = (await tools.agent_memory_recall?.execute?.(
			{ query: 'where do I live?', k: 5 },
			execOpts,
		)) as { hits: Array<{ text: string; score: number }> };

		expect(client.recall).toHaveBeenCalledWith('where do I live?', {
			k: 5,
			lens: 'user/tobie',
			sessionId: 's1',
		});
		expect(out.hits[0]).toEqual({
			text: 'recall one',
			score: 0.9,
			source: 'fact',
		});
	});

	it('agent_memory_context returns the context text', async () => {
		const client = createFakeClient();
		const tools = buildTools(client, { scopes: 'user/tobie' });

		const out = (await tools.agent_memory_context?.execute?.(
			{ query: 'preferences' },
			execOpts,
		)) as { context: string };

		expect(client.context).toHaveBeenCalledWith('preferences', {
			k: 8,
			lens: 'user/tobie',
		});
		expect(out.context).toBe('CONTEXT_TEXT');
	});

	it('agent_memory_remember persists a fact with the bound scope', async () => {
		const client = createFakeClient();
		const tools = buildTools(client, {
			scopes: 'user/tobie',
			sessionId: 's1',
		});

		const out = (await tools.agent_memory_remember?.execute?.(
			{ text: 'I got promoted' },
			execOpts,
		)) as { stored: boolean };

		expect(client.remember).toHaveBeenCalledWith('I got promoted', {
			scopes: 'user/tobie',
			sessionId: 's1',
		});
		expect(out.stored).toBe(true);
	});

	it('agent_memory_forget returns the deleted count', async () => {
		const client = createFakeClient();
		const tools = buildTools(client);

		const out = (await tools.agent_memory_forget?.execute?.(
			{ query: 'old notes', purge: true },
			execOpts,
		)) as { deleted: number };

		expect(client.forget).toHaveBeenCalledWith('old notes', {
			purge: true,
		});
		expect(out.deleted).toBe(3);
	});

	it('agent_memory_reflect passes the persist flag through', async () => {
		const client = createFakeClient();
		const tools = buildTools(client);

		const out = (await tools.agent_memory_reflect?.execute?.(
			{ query: 'what changed?', persist: true },
			execOpts,
		)) as { reflection: string };

		expect(client.reflect).toHaveBeenCalledWith('what changed?', {
			persist: true,
		});
		expect(out.reflection).toBe('REFLECTION');
	});

	it('agent_memory_inspect resolves a ref', async () => {
		const client = createFakeClient();
		const tools = buildTools(client);

		await tools.agent_memory_inspect?.execute?.(
			{ ref: 'entity:person/tobie' },
			execOpts,
		);

		expect(client.inspect).toHaveBeenCalledWith('entity:person/tobie');
	});
});
