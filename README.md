# Antigravity Client & SDK

A TypeScript client library and CLI tool for interacting with the **Antigravity Language Server (LS)** using the Connect (gRPC) protocol. Fully compatible with Antigravity 2.0.

This library is an unofficial API developed by reverse-engineering the frontend code and backend communication of the Antigravity IDE, reconstructing the original Protobuf schemas to provide programmatic access to its core features.

---

## 🤖 A Powerful Infrastructure for AI Agents

Antigravity LS is not just a tool; it is a **robust foundation for building autonomous AI agents.** By using this SDK, you can leverage the Language Server as a managed backend for your custom agents.

- **Managed Context & Sessions**: The LS server handles the complex heavy lifting of session management and context window optimization. This allows you to focus on high-layer development and agent logic rather than low-level state handling.
- **Advanced Prompt Tuning**: Inject custom prompts and metadata at a per-message level. This granular control allows for precise adjustment of agent behavior in specific scenarios.
- **Integrated Tooling & Search**: Seamlessly integrate web search, file indexing, and terminal execution. You can build custom agents that utilize these tools with surgical precision through a single SDK interface.

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

- **Method 1**: SDK auto-detects the LS process and connects directly.
- **Method 2**: SDK launches its own Mock Extension Server to supply OAuth tokens to the LS via the USS (Unified State Sync) protocol.

---

## 📋 License
MIT License
