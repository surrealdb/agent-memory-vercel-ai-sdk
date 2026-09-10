# Basic example

Shows Agent Memory persisting across two separate `generateText` calls.

## Setup

From the repo root:

```sh
bun install
```

Set the required environment variables:

```sh
export AGENT_MEMORY_ENDPOINT="https://<your-agent-memory-endpoint>"
export AGENT_MEMORY_API_KEY="sp-..."
export AGENT_MEMORY_CONTEXT="<your-context-id>"
export OPENAI_API_KEY="sk-..."
```

> Agent Memory is in invite-only preview — you need an Agent Memory context and API key.
> See <https://surrealdb.com/agent-memory>.

## Run

```sh
cd examples/basic
bun run start
```

The first call states a fact ("I got promoted to CTO and live in Lisbon"); the
second call — with no chat history passed — answers "What is my role and where do
I live?" purely from the memory Agent Memory injected.
