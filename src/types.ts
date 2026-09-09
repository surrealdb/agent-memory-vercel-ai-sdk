import type { AgentMemory, Scope } from '@surrealdb/memory';

/**
 * How the middleware retrieves memory to inject before generation:
 * - `'context'` — AgentMemory's server-formatted context text (`client.context`).
 * - `'recall'` — raw semantic hits (`client.recall`), formatted as a list.
 * - `false` — retrieve nothing (still stores the exchange, still injects the
 *   profile when enabled).
 */
export type MemoryRetrievalMode = 'context' | 'recall' | false;

/** Configuration for {@link createAgentMemory}. */
export interface CreateAgentMemoryConfig {
	/**
	 * A preconstructed AgentMemory client. When provided, `endpoint` / `apiKey` /
	 * `context` are ignored.
	 */
	client?: AgentMemory;
	/** API endpoint origin. Defaults to `process.env.AGENT_MEMORY_ENDPOINT`. */
	endpoint?: string;
	/** Bearer API key. Defaults to `process.env.AGENT_MEMORY_API_KEY`. */
	apiKey?: string;
	/** AgentMemory context id. Defaults to `process.env.AGENT_MEMORY_CONTEXT`. */
	context?: string;
	/**
	 * Default scope binding applied to every `middleware()` / `tools()` call
	 * unless overridden. E.g. `'user/tobie'`.
	 */
	defaultScopes?: Scope;
	/**
	 * Default handler for memory errors. Memory operations are fail-open, so a
	 * AgentMemory outage degrades to a plain LLM call rather than throwing.
	 */
	onError?: (error: unknown) => void;
}

/** Options for {@link AgentMemoryProvider.middleware}. */
export interface MiddlewareOptions {
	/** DNF scope selector for reads and writes, e.g. `'user/tobie'`. */
	scopes?: Scope;
	/** Session to attach retrieved context and stored turns to. */
	sessionId?: string;
	/** Inject retrieved memory before generation. Defaults to `true`. */
	injectHistory?: boolean;
	/** Store the user + assistant exchange after generation. Defaults to `true`. */
	store?: boolean;
	/** Retrieval strategy for injected memory. Defaults to `'context'`. */
	retrieval?: MemoryRetrievalMode;
	/** Maximum hits / context breadth to retrieve. Defaults to `8`. */
	k?: number;
	/** Inject the user's profile (`client.profile`). Defaults to `true`. */
	includeProfile?: boolean;
	/** Called when a memory operation fails; generation still proceeds. */
	onError?: (error: unknown) => void;
}

/** Options for {@link AgentMemoryProvider.tools}. */
export interface ToolsOptions {
	/** DNF scope selector bound to every tool call, e.g. `'user/tobie'`. */
	scopes?: Scope;
	/** Session bound to memory writes and recall performed by the tools. */
	sessionId?: string;
}
