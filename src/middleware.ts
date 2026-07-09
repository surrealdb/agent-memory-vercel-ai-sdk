import type { Spectron } from '@surrealdb/spectron';
import type { LanguageModelMiddleware } from 'ai';
import {
	buildMemoryBlock,
	collectText,
	latestUserText,
	withSystemMemory,
} from './prompt';
import type { MiddlewareOptions } from './types';

type ProfileResult = Awaited<ReturnType<Spectron['profile']>>;

/** A single stream frame we care about; other fields pass through untouched. */
type StreamChunk = { type: string; delta?: string };

/** Formats a Spectron profile into a compact, prompt-friendly list. */
function formatProfile(profile: ProfileResult): string {
	const lines: string[] = [];
	for (const entry of [
		...(profile.static ?? []),
		...(profile.dynamic ?? []),
		...(profile.preferences ?? []),
	]) {
		if (entry.value) {
			lines.push(`- ${entry.key}: ${entry.value}`);
		}
	}
	for (const instruction of profile.instructions ?? []) {
		if (instruction.description) {
			lines.push(`- ${instruction.description}`);
		}
	}
	return lines.length > 0 ? `User profile:\n${lines.join('\n')}` : '';
}

/**
 * Builds a Vercel AI SDK language-model middleware backed by a Spectron client.
 *
 * - `transformParams` retrieves memory (and optionally the profile) for the
 *   latest user message and injects it as a system message.
 * - `wrapGenerate` / `wrapStream` persist the resulting user + assistant
 *   exchange back to Spectron.
 *
 * All memory operations are fail-open: on error the middleware invokes
 * `onError` and lets generation proceed as a normal LLM call.
 */
export function buildMiddleware(
	client: Spectron,
	options: MiddlewareOptions = {},
): LanguageModelMiddleware {
	const { scopes, sessionId } = options;
	const injectHistory = options.injectHistory ?? true;
	const store = options.store ?? true;
	const retrieval = options.retrieval ?? 'context';
	const k = options.k ?? 8;
	const includeProfile = options.includeProfile ?? true;
	const onError = options.onError ?? (() => {});

	async function retrieveMemory(query: string): Promise<string | null> {
		const sections: string[] = [];
		const tasks: Promise<void>[] = [];

		if (injectHistory && retrieval !== false && query) {
			if (retrieval === 'context') {
				tasks.push(
					client
						.context(query, { k, lens: scopes })
						.then((result) => {
							if (result?.context) {
								sections.push(
									`Relevant memory:\n${result.context}`,
								);
							}
						}),
				);
			} else {
				tasks.push(
					client.recall(query, { k, lens: scopes }).then((result) => {
						const hits = result?.hits ?? [];
						if (hits.length > 0) {
							const list = hits
								.map((hit) => `- ${hit.text}`)
								.join('\n');
							sections.push(`Relevant memory:\n${list}`);
						}
					}),
				);
			}
		}

		if (includeProfile) {
			tasks.push(
				client.profile().then((profile) => {
					const text = formatProfile(profile);
					if (text) {
						sections.push(text);
					}
				}),
			);
		}

		await Promise.all(tasks);
		return buildMemoryBlock(sections);
	}

	async function persist(query: string, reply: string): Promise<void> {
		const messages: { role: 'user' | 'assistant'; content: string }[] = [];
		if (query) {
			messages.push({ role: 'user', content: query });
		}
		if (reply) {
			messages.push({ role: 'assistant', content: reply });
		}
		if (messages.length === 0) {
			return;
		}
		try {
			await client.rememberMany(messages, { sessionId, scopes });
		} catch (error) {
			onError(error);
		}
	}

	return {
		async transformParams({ params }) {
			if (!injectHistory && !includeProfile) {
				return params;
			}
			try {
				const query = latestUserText(params.prompt);
				if (!query) {
					return params;
				}
				const block = await retrieveMemory(query);
				if (!block) {
					return params;
				}
				return {
					...params,
					prompt: withSystemMemory(params.prompt, block),
				};
			} catch (error) {
				onError(error);
				return params;
			}
		},

		async wrapGenerate({ doGenerate, params }) {
			const result = await doGenerate();
			if (store) {
				await persist(
					latestUserText(params.prompt),
					collectText(result.content),
				);
			}
			return result;
		},

		async wrapStream({ doStream, params }) {
			const { stream, ...rest } = await doStream();
			if (!store) {
				return { ...rest, stream };
			}
			const query = latestUserText(params.prompt);
			let reply = '';
			const accumulator = new TransformStream<StreamChunk, StreamChunk>({
				transform(chunk, controller) {
					if (
						chunk.type === 'text-delta' &&
						typeof chunk.delta === 'string'
					) {
						reply += chunk.delta;
					}
					controller.enqueue(chunk);
				},
				flush() {
					// Fire-and-forget so closing the stream is never blocked on
					// the memory write; errors are swallowed by `persist`.
					void persist(query, reply);
				},
			});
			return {
				...rest,
				stream: stream.pipeThrough(accumulator) as typeof stream,
			};
		},
	};
}
