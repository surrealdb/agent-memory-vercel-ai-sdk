/**
 * Pure helpers for reading and rewriting the provider-level prompt that the
 * Vercel AI SDK hands to middleware. These operate structurally on the
 * `LanguageModelV*` message shape so the package stays decoupled from a specific
 * `@ai-sdk/provider` version:
 *
 * - system messages are `{ role: 'system', content: string }`
 * - user / assistant messages are `{ role, content: Array<{ type, ... }> }`
 * - text parts are `{ type: 'text', text: string }`
 */

/** Header prefixed to the injected memory system message. */
export const MEMORY_HEADER =
	'The following is relevant long-term memory retrieved from Agent Memory for ' +
	'the current user. Use it to ground your response; do not repeat it back ' +
	'verbatim unless asked.';

type TextLike = { type?: unknown; text?: unknown };

function isTextPart(part: unknown): part is { type: 'text'; text: string } {
	return (
		typeof part === 'object' &&
		part !== null &&
		(part as TextLike).type === 'text' &&
		typeof (part as TextLike).text === 'string'
	);
}

/**
 * Concatenates the text of a message `content` value. Accepts a bare string
 * (system messages) or an array of content parts (user / assistant / tool
 * messages), and ignores every non-text part.
 */
export function collectText(content: unknown): string {
	if (typeof content === 'string') {
		return content;
	}
	if (!Array.isArray(content)) {
		return '';
	}
	return content
		.filter(isTextPart)
		.map((part) => part.text)
		.join('');
}

/**
 * Returns the text of the most recent `user` message in a prompt — the query we
 * retrieve memory for and store as the user turn. Empty string when there is no
 * user message.
 */
export function latestUserText(prompt: unknown): string {
	if (!Array.isArray(prompt)) {
		return '';
	}
	for (let i = prompt.length - 1; i >= 0; i--) {
		const message = prompt[i] as { role?: unknown; content?: unknown };
		if (message && message.role === 'user') {
			return collectText(message.content).trim();
		}
	}
	return '';
}

/**
 * Assembles the retrieved sections into a single memory block, or `null` when
 * every section is empty (so callers can skip injection entirely).
 */
export function buildMemoryBlock(sections: string[]): string | null {
	const filled = sections.map((section) => section.trim()).filter(Boolean);
	if (filled.length === 0) {
		return null;
	}
	return `${MEMORY_HEADER}\n\n${filled.join('\n\n')}`;
}

/**
 * Returns a copy of `prompt` with the memory block injected as system context.
 * When the prompt already opens with a string system message the block is
 * prepended to it; otherwise a new leading system message is added. The input
 * is never mutated and the original prompt type is preserved.
 */
export function withSystemMemory<T>(prompt: T, block: string): T {
	if (!Array.isArray(prompt)) {
		return prompt;
	}
	const messages = [...prompt] as unknown[];
	const first = messages[0] as
		| { role?: unknown; content?: unknown }
		| undefined;
	if (first && first.role === 'system' && typeof first.content === 'string') {
		messages[0] = { ...first, content: `${block}\n\n${first.content}` };
	} else {
		messages.unshift({ role: 'system', content: block });
	}
	return messages as T;
}
