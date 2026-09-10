export type { AgentMemoryOptions, Scope } from '@surrealdb/memory';
// Re-exported for convenience so consumers can construct or type a client
// without a second import.
export { AgentMemory } from '@surrealdb/memory';
export { buildMiddleware } from './middleware';
export type { AgentMemoryProvider } from './provider';
export { createAgentMemory } from './provider';
export { buildTools } from './tools';
export type {
	CreateAgentMemoryConfig,
	MemoryRetrievalMode,
	MiddlewareOptions,
	ToolsOptions,
} from './types';
