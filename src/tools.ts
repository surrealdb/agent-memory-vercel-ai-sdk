import type { AgentMemory } from '@surrealdb/memory';
import { jsonSchema, type ToolSet, tool } from 'ai';
import type { ToolsOptions } from './types';

/**
 * Builds a Vercel AI SDK {@link ToolSet} that exposes AgentMemory's memory
 * operations to the model, for on-demand queries during generation. Tool inputs
 * use `jsonSchema` (no `zod` dependency). Every tool is bound to the scope and
 * session supplied in {@link ToolsOptions}.
 */
export function buildTools(
	client: AgentMemory,
	options: ToolsOptions = {},
): ToolSet {
	const { scopes, sessionId } = options;

	return {
		agent_memory_recall: tool({
			description:
				'Search long-term memory for facts and passages relevant to a ' +
				'natural-language query. Returns the top matching hits.',
			inputSchema: jsonSchema<{ query: string; k?: number }>({
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'What to search memory for.',
					},
					k: {
						type: 'number',
						description: 'Maximum number of hits (default 8).',
					},
				},
				required: ['query'],
				additionalProperties: false,
			}),
			execute: async ({ query, k }) => {
				const result = await client.recall(query, {
					k: k ?? 8,
					lens: scopes,
					sessionId,
				});
				return {
					hits: (result.hits ?? []).map((hit) => ({
						text: hit.text,
						score: hit.score,
						source: hit.source,
					})),
				};
			},
		}),

		agent_memory_context: tool({
			description:
				'Retrieve AgentMemory-formatted context text summarising what is ' +
				'known that is relevant to a query, ready for prompt injection.',
			inputSchema: jsonSchema<{ query: string; k?: number }>({
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'The topic to summarise context for.',
					},
					k: {
						type: 'number',
						description: 'Context breadth (default 8).',
					},
				},
				required: ['query'],
				additionalProperties: false,
			}),
			execute: async ({ query, k }) => {
				const result = await client.context(query, {
					k: k ?? 8,
					lens: scopes,
				});
				return { context: result.context };
			},
		}),

		agent_memory_reflect: tool({
			description:
				'Synthesise an answer over stored memory (traits, preferences, ' +
				'patterns). Optionally persist the conclusion for future recall.',
			inputSchema: jsonSchema<{ query: string; persist?: boolean }>({
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'The question to reflect on.',
					},
					persist: {
						type: 'boolean',
						description:
							'Persist the derived conclusion (default false).',
					},
				},
				required: ['query'],
				additionalProperties: false,
			}),
			execute: async ({ query, persist }) => {
				const result = await client.reflect(query, {
					persist: persist ?? false,
				});
				return {
					reflection: result.reflection,
					evidence: result.evidence,
				};
			},
		}),

		agent_memory_remember: tool({
			description:
				'Persist a fact or observation into long-term memory so it can ' +
				'be recalled in future sessions.',
			inputSchema: jsonSchema<{ text: string }>({
				type: 'object',
				properties: {
					text: {
						type: 'string',
						description: 'The fact or observation to store.',
					},
				},
				required: ['text'],
				additionalProperties: false,
			}),
			execute: async ({ text }) => {
				const result = await client.remember(text, {
					scopes,
					sessionId,
				});
				return { stored: true, sessionId: result.sessionId };
			},
		}),

		agent_memory_forget: tool({
			description:
				'Forget memories matching a natural-language query (soft-delete). ' +
				'Returns how many memories were removed.',
			inputSchema: jsonSchema<{ query: string; purge?: boolean }>({
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'Describes the memories to forget.',
					},
					purge: {
						type: 'boolean',
						description:
							'Also remove supersession history (default false).',
					},
				},
				required: ['query'],
				additionalProperties: false,
			}),
			execute: async ({ query, purge }) => {
				const result = await client.forget(query, {
					purge: purge ?? false,
				});
				return { deleted: result.deleted };
			},
		}),

		agent_memory_profile: tool({
			description:
				"Get the user's profile: static facts, dynamic attributes, " +
				'preferences, and standing instructions.',
			inputSchema: jsonSchema<Record<string, never>>({
				type: 'object',
				properties: {},
				additionalProperties: false,
			}),
			execute: async () => {
				const profile = await client.profile();
				return {
					static: profile.static,
					dynamic: profile.dynamic,
					preferences: profile.preferences,
					instructions: profile.instructions,
				};
			},
		}),

		agent_memory_inspect: tool({
			description:
				'Resolve a AgentMemory reference (e.g. `entity:person/tobie`, ' +
				'`attribute:...`, `relation:...`, `trace:...`) to its normalised view.',
			inputSchema: jsonSchema<{ ref: string }>({
				type: 'object',
				properties: {
					ref: {
						type: 'string',
						description:
							'The inspect ref, e.g. `entity:person/tobie`.',
					},
				},
				required: ['ref'],
				additionalProperties: false,
			}),
			execute: async ({ ref }) => {
				return await client.inspect(ref);
			},
		}),
	};
}
