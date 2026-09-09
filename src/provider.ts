import { AgentMemory, type AgentMemoryOptions } from '@surrealdb/memory';
import type { LanguageModelMiddleware, ToolSet } from 'ai';
import { buildMiddleware } from './middleware';
import { buildTools } from './tools';
import type {
	CreateAgentMemoryConfig,
	MiddlewareOptions,
	ToolsOptions,
} from './types';

/** The object returned by {@link createAgentMemory}. */
export interface AgentMemoryProvider {
	/** The underlying AgentMemory client (use it directly for anything not wrapped). */
	client: AgentMemory;
	/** A language-model middleware that injects and stores memory. */
	middleware(options?: MiddlewareOptions): LanguageModelMiddleware;
	/** A tool set exposing AgentMemory memory operations to the model. */
	tools(options?: ToolsOptions): ToolSet;
}

function resolveClientOptions(
	config: CreateAgentMemoryConfig,
): AgentMemoryOptions {
	const endpoint = config.endpoint ?? process.env.AGENT_MEMORY_ENDPOINT;
	const apiKey = config.apiKey ?? process.env.AGENT_MEMORY_API_KEY;
	const context = config.context ?? process.env.AGENT_MEMORY_CONTEXT;

	if (!endpoint) {
		throw new Error(
			'createAgentMemory: missing `endpoint`. Pass config.endpoint, set ' +
				'AGENT_MEMORY_ENDPOINT, or pass a preconstructed `client`.',
		);
	}
	if (!apiKey) {
		throw new Error(
			'createAgentMemory: missing `apiKey`. Pass config.apiKey, set ' +
				'AGENT_MEMORY_API_KEY, or pass a preconstructed `client`.',
		);
	}
	if (!context) {
		throw new Error(
			'createAgentMemory: missing `context`. Pass config.context, set ' +
				'AGENT_MEMORY_CONTEXT, or pass a preconstructed `client`.',
		);
	}

	return { endpoint, apiKey, context };
}

/**
 * Creates a AgentMemory provider for the Vercel AI SDK.
 *
 * Mirrors the Honcho integration: `createAgentMemory().middleware()` wraps your
 * own model (via `wrapLanguageModel`) to give `generateText` / `streamText`
 * long-term memory, and `createAgentMemory().tools()` exposes memory operations to
 * the model.
 *
 * @example
 * ```ts
 * import { openai } from '@ai-sdk/openai';
 * import { generateText, wrapLanguageModel } from 'ai';
 * import { createAgentMemory } from '@surrealdb/agent-memory-vercel-ai';
 *
 * const agentMemory = createAgentMemory({ defaultScopes: 'user/tobie' });
 *
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: agentMemory.middleware(),
 * });
 *
 * const { text } = await generateText({
 *   model,
 *   tools: agentMemory.tools(),
 *   prompt: 'What should I focus on today?',
 * });
 * ```
 */
export function createAgentMemory(
	config: CreateAgentMemoryConfig = {},
): AgentMemoryProvider {
	const client =
		config.client ?? new AgentMemory(resolveClientOptions(config));

	return {
		client,
		middleware(options: MiddlewareOptions = {}) {
			return buildMiddleware(client, {
				scopes: config.defaultScopes,
				onError: config.onError,
				...options,
			});
		},
		tools(options: ToolsOptions = {}) {
			return buildTools(client, {
				scopes: config.defaultScopes,
				...options,
			});
		},
	};
}
