import { describe, expect, it } from 'vitest';
import {
	buildMemoryBlock,
	collectText,
	latestUserText,
	MEMORY_HEADER,
	withSystemMemory,
} from '../src/prompt';

describe('collectText', () => {
	it('returns a bare string unchanged', () => {
		expect(collectText('hello')).toBe('hello');
	});

	it('concatenates text parts and ignores non-text parts', () => {
		const content = [
			{ type: 'text', text: 'foo ' },
			{ type: 'image', image: 'x' },
			{ type: 'text', text: 'bar' },
		];
		expect(collectText(content)).toBe('foo bar');
	});

	it('returns empty string for non-array, non-string input', () => {
		expect(collectText(undefined)).toBe('');
		expect(collectText(42)).toBe('');
	});
});

describe('latestUserText', () => {
	it('returns the text of the last user message', () => {
		const prompt = [
			{ role: 'system', content: 'be nice' },
			{ role: 'user', content: [{ type: 'text', text: 'first' }] },
			{ role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
			{ role: 'user', content: [{ type: 'text', text: 'second' }] },
		];
		expect(latestUserText(prompt)).toBe('second');
	});

	it('returns empty string when there is no user message', () => {
		const prompt = [{ role: 'system', content: 'be nice' }];
		expect(latestUserText(prompt)).toBe('');
	});

	it('returns empty string for a non-array prompt', () => {
		expect(latestUserText(null)).toBe('');
	});
});

describe('buildMemoryBlock', () => {
	it('joins non-empty sections under the header', () => {
		const block = buildMemoryBlock(['  a ', '', '  b']);
		expect(block).toBe(`${MEMORY_HEADER}\n\na\n\nb`);
	});

	it('returns null when every section is empty', () => {
		expect(buildMemoryBlock(['', '   '])).toBeNull();
	});
});

describe('withSystemMemory', () => {
	it('prepends a new system message when none exists', () => {
		const prompt = [
			{ role: 'user', content: [{ type: 'text', text: 'hi' }] },
		];
		const next = withSystemMemory(prompt, 'MEMORY') as Array<{
			role: string;
			content: unknown;
		}>;
		expect(next).toHaveLength(2);
		expect(next[0]).toEqual({ role: 'system', content: 'MEMORY' });
		// original is untouched
		expect(prompt).toHaveLength(1);
	});

	it('merges into an existing leading string system message', () => {
		const prompt = [
			{ role: 'system', content: 'base' },
			{ role: 'user', content: [{ type: 'text', text: 'hi' }] },
		];
		const next = withSystemMemory(prompt, 'MEMORY') as Array<{
			role: string;
			content: string;
		}>;
		expect(next).toHaveLength(2);
		expect(next[0]).toEqual({ role: 'system', content: 'MEMORY\n\nbase' });
	});
});
