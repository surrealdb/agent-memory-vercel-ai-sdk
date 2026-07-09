export type { Scope, SpectronOptions } from '@surrealdb/spectron';
// Re-exported for convenience so consumers can construct or type a client
// without a second import.
export { Spectron } from '@surrealdb/spectron';
export { buildMiddleware } from './middleware';
export type { SpectronProvider } from './provider';
export { createSpectron } from './provider';
export { buildTools } from './tools';
export type {
	CreateSpectronConfig,
	MemoryRetrievalMode,
	MiddlewareOptions,
	ToolsOptions,
} from './types';
