import { openai } from '@ai-sdk/openai';
import { createAgentMemory } from '@surrealdb/agent-memory-vercel-ai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';

/**
 * Minimal end-to-end demo of AgentMemory memory across two separate calls.
 *
 * Required environment variables:
 *   AGENT_MEMORY_ENDPOINT   AgentMemory API endpoint origin
 *   AGENT_MEMORY_API_KEY    AgentMemory bearer API key
 *   AGENT_MEMORY_CONTEXT    AgentMemory context id
 *   OPENAI_API_KEY      OpenAI key for the model provider
 *
 * Run with:  bun run src/index.ts
 */
async function main() {
	// Reads AGENT_MEMORY_* from the environment; bind everything to one user.
	const agentMemory = createAgentMemory({ defaultScopes: 'user/demo' });

	// Wrap your own model — the middleware injects memory before generation
	// and stores each exchange afterward.
	const model = wrapLanguageModel({
		model: openai('gpt-4o'),
		middleware: agentMemory.middleware({ sessionId: 'demo-session' }),
	});

	// First call: state a fact. The middleware stores this exchange.
	const first = await generateText({
		model,
		prompt: 'Hi! Just so you know, I just got promoted to CTO and I live in Lisbon.',
	});
	console.log('\n[1] assistant:', first.text);

	// Second call (fresh prompt, no history passed): the middleware recalls
	// what was stored and injects it, so the model can answer from memory.
	const second = await generateText({
		model,
		// Give the model the memory tools too, for on-demand lookups.
		tools: agentMemory.tools({ sessionId: 'demo-session' }),
		stopWhen: stepCountIs(3),
		prompt: 'What is my role and where do I live?',
	});
	console.log('\n[2] assistant:', second.text);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
