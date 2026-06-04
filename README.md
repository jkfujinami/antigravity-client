# Antigravity Client & SDK

A robust, modern TypeScript client library and CLI tool for interacting with the **Antigravity Language Server (LS)** via the Connect (gRPC) protocol. Fully compatible with Antigravity 2.0.

This library is an unofficial API developed by reverse-engineering the frontend code and backend communication of the Antigravity IDE, reconstructing the original Protobuf schemas to provide programmatic access to its core features.

---

## 🤖 A Powerful Infrastructure for AI Agents

Antigravity LS is not just a tool; it is a **robust foundation for building autonomous AI agents.** By using this SDK, you can leverage the Language Server as a managed backend for your custom agents.

- **Managed Context & Sessions**: The LS server handles the complex heavy lifting of session management and context window optimization. This allows you to focus on high-layer development and agent logic rather than low-level state handling.
- **Advanced Prompt Tuning**: Inject custom prompts and metadata at a per-message level. This granular control allows for precise adjustment of agent behavior in specific scenarios.
- **Integrated Tooling & Search**: Seamlessly integrate web search, file indexing, and terminal execution. You can build custom agents that utilize these tools with surgical precision through a single SDK interface.
- **Event-Driven Architecture**: The SDK features a modern, event-driven `Cascade` API, cleanly separating stream management, state parsing, and API interaction, making it highly extensible and easy to reason about.

By offloading context management to the LS, you can spend your time engineering the "brain" of your agent rather than its infrastructure.

---

## ⚠️ Disclaimer

- **Unofficial**: This project is an unofficial implementation and is not affiliated with Google or DeepMind.
- **No Warranty**: The developers are not responsible for any damage caused by the use of this software.
- **Terms of Service**: Please comply with the official Antigravity/Google AI terms of service when using this library.
- **Platform**: Currently **macOS only**. Auto-detection, binary paths, and database reading are optimized for macOS.

---

## 🚀 Quick Start

### Installation

```bash
npm install github:jkfujinami/antigravity-client
```

### Basic Usage

```typescript
import { AntigravityClient } from "antigravity-client";

// Connect to the existing IDE process
const client = await AntigravityClient.connect();
const status = await client.getUserStatus();
console.log(`Connected as: ${status.userStatus?.name}`);
```

---

## 🔌 Connection Methods

### 1. Connect to Existing IDE (Recommended)
Automatically detects the Language Server process started by the official Antigravity IDE.

```typescript
const client = await AntigravityClient.connect();
```

### 2. Standalone Launch (No IDE Required)
Starts a Mock Extension Server and launches the LS binary independently.

```typescript
const client = await AntigravityClient.launch({
    workspacePath: "/path/to/project",
    verbose: true,
});
```

---

## 🧠 Event-Driven Cascade API

The `Cascade` class is the core of the SDK for managing interactions with the AI. It provides an event-driven API to handle real-time streaming, status changes, and tool approvals.

```typescript
import { AntigravityClient, CascadeEvents } from "antigravity-client";

const client = await AntigravityClient.connect();
const cascade = await client.startCascade();

// Listen for AI thinking and responses
cascade.on(CascadeEvents.Thinking, (ev) => process.stdout.write(ev.delta));
cascade.on(CascadeEvents.Text, (ev) => process.stdout.write(ev.delta));

// Handle interactions (e.g., terminal commands, file edits)
cascade.on(CascadeEvents.Interaction, async (req) => {
    console.log(`\n[Requires Approval]: ${req.description}`);
    if (req.type === "run_command") {
        await req.approve(); // Approve the command execution
    } else {
        await req.deny();
    }
});

await cascade.run("List all files in the current directory and explain them.");
```

---

## 🛠️ Direct Language Server Communication

For advanced use cases, you can bypass the high-level wrappers and communicate directly with the Language Server via the exposed `languageServer` client. This gives you complete freedom to execute any RPC method.

```typescript
import { AntigravityClient } from "antigravity-client";

const client = await AntigravityClient.connect();

// Direct RPC call to the Language Server
const response = await client.languageServer.acceptTermsOfService({
    // Provide necessary Protobuf message fields
});
console.log("TOS Accepted:", response);
```

For more comprehensive examples, check the `examples/` directory.

---

## 🏗️ Architecture

```
┌──────────────────┐       ┌───────────────────────┐       ┌─────────────┐
│  Your App / CLI  │──────>│  Language Server (LS) │<──────│  Google API │
│  (SDK Client)    │ gRPC  │  (Go binary)          │ HTTPS │             │
└──────────────────┘       └───────────────────────┘       └─────────────┘
                                   ▲
                                   │ Connect RPC
                           ┌────────────────────────┐
                           │ Mock Extension Server  │
                           │ (OAuth token provider) │
                           └────────────────────────┘
```

The SDK architecture is designed with modularity and separation of concerns:
- `src/core/`: Core client logic, including the `AntigravityClient` and `Cascade` orchestrator.
- `src/core/cascade/`: The Event-Driven engine for processing AI streams. Split into `stream-handler` (gRPC streams) and `event-parser` (state diffing).
- `src/types/`: High-level TypeScript typings for Events and States.
- `src/utils/`: Auto-detection and utilities for finding the running IDE.
- `src/cli/`: Interactive CLI (REPL) implementation.

- **Method 1**: SDK auto-detects the LS process and connects directly.
- **Method 2**: SDK launches its own Mock Extension Server to supply OAuth tokens to the LS via the USS (Unified State Sync) protocol.

---

## 📋 License
MIT License
