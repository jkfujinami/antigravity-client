# Antigravity Client

A TypeScript client library and CLI tool for interacting with the **Antigravity Language Server (LS)** using the Connect (gRPC) protocol.

This library provides a high-level API to manage chat sessions ("Cascades"), execute commands, and stream reactive updates from the AI agent.

## Features

- **Auto-Discovery**: Automatically finds the running Antigravity LS process, port, and CSRF token.
- **Cascade Management**: Start, resume, and manage chat sessions with state persistence.
- **Reactive Streaming**: Real-time streaming of AI thinking, text responses, and tool executions.
- **Interactive CLI**: A built-in REPL for chatting with the agent directly from your terminal.

## Prerequisites

- Node.js (v18 or later)
- An active instance of the Antigravity Language Server (usually running in the background via IDE extensions like VS Code).

## Installation

```bash
npm install
```

## Usage

### Interactive CLI

To start the interactive chat session:

```bash
npm run cli
```

commands inside CLI:
- `/new`: Start a fresh session.
- `/reset`: Same as `/new`.
- `/exit` or `/quit`: Exit the CLI.
- `/info`: Show current session details.

### Library Usage

You can use the `AntigravityClient` to build your own tools or integrations.

```typescript
import { AntigravityClient } from "./src/client.js";

async function main() {
  // 1. Connect to the Language Server (Auto-detects port & token)
  const client = await AntigravityClient.connect({ autoDetect: true });

  // 2. Start a new Cascade (Chat Session)
  const cascade = await client.startCascade("gemini-3-flash");

  // 3. Listen for events
  cascade.on("text", (event) => {
    process.stdout.write(event.delta);
  });

  cascade.on("thinking", (event) => {
    console.log(`[Thinking]: ${event.delta}`);
  });

  // 4. Send a message
  await cascade.sendMessage("Hello, who are you?");
}

main();
```

## Directory Structure

- `src/`: Source code for the library and CLI.
  - `client.ts`: Main client entry point.
  - `cascade.ts`: Manages individual chat sessions.
  - `repl.ts`: The interactive CLI implementation.
  - `gen/`: Generated Protocol Buffer definitions.
- `test/`: Test scripts and examples.

## License

ISC
