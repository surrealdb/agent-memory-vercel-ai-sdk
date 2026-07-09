# Basic example

Shows Spectron memory persisting across two separate `generateText` calls.

## Setup

From the repo root:

```sh
bun install
```

Set the required environment variables:

```sh
export SPECTRON_ENDPOINT="https://<your-spectron-endpoint>"
export SPECTRON_API_KEY="sp-..."
export SPECTRON_CONTEXT="<your-context-id>"
export OPENAI_API_KEY="sk-..."
```

> Spectron is in invite-only preview — you need a Spectron context and API key.
> See <https://surrealdb.com/platform/spectron>.

## Run

```sh
cd examples/basic
bun run start
```

The first call states a fact ("I got promoted to CTO and live in Lisbon"); the
second call — with no chat history passed — answers "What is my role and where do
I live?" purely from the memory Spectron injected.
