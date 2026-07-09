import { Spectron, type SpectronOptions } from '@surrealdb/spectron';
import type { LanguageModelMiddleware, ToolSet } from 'ai';
import { buildMiddleware } from './middleware';
import { buildTools } from './tools';
import type {
	CreateSpectronConfig,
	MiddlewareOptions,
	ToolsOptions,
} from './types';

/** The object returned by {@link createSpectron}. */
export interface SpectronProvider {
	/** The underlying Spectron client (use it directly for anything not wrapped). */
	client: Spectron;
	/** A language-model middleware that injects and stores memory. */
	middleware(options?: MiddlewareOptions): LanguageModelMiddleware;
	/** A tool set exposing Spectron memory operations to the model. */
	tools(options?: ToolsOptions): ToolSet;
}

function resolveClientOptions(config: CreateSpectronConfig): SpectronOptions {
	const endpoint = config.endpoint ?? process.env.SPECTRON_ENDPOINT;
	const apiKey = config.apiKey ?? process.env.SPECTRON_API_KEY;
	const context = config.context ?? process.env.SPECTRON_CONTEXT;

	if (!endpoint) {
		throw new Error(
			'createSpectron: missing `endpoint`. Pass config.endpoint, set ' +
				'SPECTRON_ENDPOINT, or pass a preconstructed `client`.',
		);
	}
	if (!apiKey) {
		throw new Error(
			'createSpectron: missing `apiKey`. Pass config.apiKey, set ' +
				'SPECTRON_API_KEY, or pass a preconstructed `client`.',
		);
	}
	if (!context) {
		throw new Error(
			'createSpectron: missing `context`. Pass config.context, set ' +
				'SPECTRON_CONTEXT, or pass a preconstructed `client`.',
		);
	}

	return { endpoint, apiKey, context };
}

/**
 * Creates a Spectron provider for the Vercel AI SDK.
 *
 * Mirrors the Honcho integration: `createSpectron().middleware()` wraps your
 * own model (via `wrapLanguageModel`) to give `generateText` / `streamText`
 * long-term memory, and `createSpectron().tools()` exposes memory operations to
 * the model.
 *
 * @example
 * ```ts
 * import { openai } from '@ai-sdk/openai';
 * import { generateText, wrapLanguageModel } from 'ai';
 * import { createSpectron } from '@surrealdb/vercel-ai';
 *
 * const spectron = createSpectron({ defaultScopes: 'user/tobie' });
 *
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: spectron.middleware(),
 * });
 *
 * const { text } = await generateText({
 *   model,
 *   tools: spectron.tools(),
 *   prompt: 'What should I focus on today?',
 * });
 * ```
 */
export function createSpectron(
	config: CreateSpectronConfig = {},
): SpectronProvider {
	const client = config.client ?? new Spectron(resolveClientOptions(config));

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
