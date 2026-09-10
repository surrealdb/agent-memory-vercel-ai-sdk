# @surrealdb/agent-memory-vercel-ai

[Vercel AI SDK](https://ai-sdk.dev) integration for **[Agent Memory](https://surrealdb.com/agent-memory)** — SurrealDB's agent memory layer.

Keep using your own model provider (`@ai-sdk/openai`, `@ai-sdk/anthropic`, …) with `generateText` / `streamText`, and let Agent Memory transparently:

- **inject** relevant long-term memory (and the user's profile) into the prompt before generation, and
- **store** each user + assistant exchange afterward,

plus an optional **tool set** so the model can query memory on demand mid-generation.

The design mirrors the [Honcho Vercel AI SDK integration](https://honcho.dev/docs/v3/guides/integrations/vercel-ai-sdk): `createAgentMemory()` → `.middleware()` / `.tools()`.

## Install

```sh
npm i @surrealdb/agent-memory-vercel-ai ai @surrealdb/memory
# plus your model provider, e.g.
npm i @ai-sdk/openai
```

`ai` (v7) is a peer dependency; you bring your own model provider.

## Setup

`createAgentMemory()` reads credentials from the environment by default:

| Variable            | Description                     |
| ------------------- | ------------------------------- |
| `AGENT_MEMORY_ENDPOINT` | API endpoint origin             |
| `AGENT_MEMORY_API_KEY`  | Bearer API key                  |
| `AGENT_MEMORY_CONTEXT`  | Agent Memory context id             |

```ts
import { createAgentMemory } from '@surrealdb/agent-memory-vercel-ai';

// From env, bound to one user by default.
const agentMemory = createAgentMemory({ defaultScopes: 'user/tobie' });

// Or pass config / a preconstructed client explicitly:
import { AgentMemory } from '@surrealdb/agent-memory-vercel-ai';
const agentMemory = createAgentMemory({
  client: new AgentMemory({ endpoint, apiKey, context }),
});
```

## Middleware

Wrap your model with `wrapLanguageModel`. The middleware fetches memory for the
latest user message and injects it as a system message, then stores the exchange
after generation.

```ts
import { openai } from '@ai-sdk/openai';
import { generateText, wrapLanguageModel } from 'ai';
import { createAgentMemory } from '@surrealdb/agent-memory-vercel-ai';

const agentMemory = createAgentMemory({ defaultScopes: 'user/tobie' });

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: agentMemory.middleware({ sessionId: 'session-123' }),
});

const { text } = await generateText({
  model,
  prompt: 'What should I focus on today?',
});
```

`streamText` works identically — the middleware wraps the stream, accumulates the
reply, and stores it when the stream finishes.

### Middleware options

| Option           | Default     | Description                                                            |
| ---------------- | ----------- | --------------------------------------------------------------------- |
| `scopes`         | `defaultScopes` | DNF scope selector for reads and writes, e.g. `'user/tobie'`.     |
| `sessionId`      | —           | Session to attach retrieved context and stored turns to.              |
| `injectHistory`  | `true`      | Inject retrieved memory before generation.                            |
| `store`          | `true`      | Store the user + assistant exchange after generation.                 |
| `retrieval`      | `'context'` | `'context'` (server-formatted), `'recall'` (raw hits), or `false`.    |
| `k`              | `8`         | Max hits / context breadth to retrieve.                               |
| `includeProfile` | `true`      | Inject the user's profile (`client.profile`).                         |
| `onError`        | no-op       | Called on memory errors; generation still proceeds (**fail-open**).   |

Memory operations are **fail-open**: if Agent Memory is unreachable, the middleware
falls back to a plain LLM call rather than throwing.

### Bring your own messages

When you already pass a full `messages` array, disable storage of the injected
history to avoid duplication by turning `store` off, or scope retrieval with
`retrieval: false` / `injectHistory: false` as needed.

## Tools

`agentMemory.tools()` returns a Vercel AI SDK `ToolSet` the model can call during
generation. Bound to the same scope / session you pass.

```ts
import { generateText, stepCountIs } from 'ai';

const { text } = await generateText({
  model,
  tools: agentMemory.tools({ sessionId: 'session-123' }),
  stopWhen: stepCountIs(3),
  prompt: 'Based on our past conversations, what do I care about most?',
});
```

| Tool                 | What it does                                                     |
| -------------------- | --------------------------------------------------------------- |
| `agent_memory_recall`    | Semantic recall of facts & passages for a query.               |
| `agent_memory_context`   | Server-formatted context text for a query.                     |
| `agent_memory_reflect`   | Synthesise over memory; optionally persist the conclusion.     |
| `agent_memory_remember`  | Persist a fact / observation for future recall.                |
| `agent_memory_forget`    | Forget memories matching a query.                              |
| `agent_memory_profile`   | The user's static/dynamic attributes, preferences, instructions. |
| `agent_memory_inspect`   | Resolve an entity / attribute / relation / trace reference.     |

## Scopes

Scopes bind reads and writes to a region of memory (a DNF selector). A bare
string is a single path; see [`@surrealdb/memory`](https://www.npmjs.com/package/@surrealdb/memory)
for the full model.

```ts
agentMemory.middleware({ scopes: 'user/tobie' });          // one user
agentMemory.middleware({ scopes: ['team/eng', 'user/x'] }); // OR of two
```

## Direct client access

`agentMemory.client` is the underlying `@surrealdb/memory` client for anything not
wrapped here (documents, sessions, entities, `chat`, etc.).

## Example

See [`examples/basic`](examples/basic) for a runnable demo showing memory recall
across two separate calls.

## License

Apache-2.0
